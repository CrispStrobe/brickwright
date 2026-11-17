// SPDX-License-Identifier: BSD-3-Clause
// The same editor-input contract as brickwright-cad's macOS host. WebKit's
// internal content view can consume precise scrolling/magnification before
// SVG/canvas listeners see it. Unhandled events continue through AppKit once.
#import <AppKit/AppKit.h>
#import <WebKit/WebKit.h>
#import <objc/runtime.h>

@interface BWEditorInputRouter : NSObject
@property(nonatomic, weak) WKWebView *view;
@property(nonatomic, strong) id monitor;
@property(nonatomic) BOOL forwarding;
@end

@implementation BWEditorInputRouter
- (void)install {
    __weak BWEditorInputRouter *weakSelf = self;
    self.monitor = [NSEvent addLocalMonitorForEventsMatchingMask:
        NSEventMaskScrollWheel | NSEventMaskMagnify handler:^NSEvent *(NSEvent *event) {
        BWEditorInputRouter *router = weakSelf;
        WKWebView *view = router.view;
        if (!view || router.forwarding || event.window != view.window) return event;
        if (event.type == NSEventTypeScrollWheel && !event.hasPreciseScrollingDeltas) return event;
        NSPoint point = [view convertPoint:event.locationInWindow fromView:nil];
        if (!NSPointInRect(point, view.bounds)) return event;
        NSMutableDictionary *payload = [@{
            @"x": @(point.x), @"y": @(view.isFlipped ? point.y : view.bounds.size.height - point.y),
            @"shiftKey": @((event.modifierFlags & NSEventModifierFlagShift) != 0),
            @"altKey": @((event.modifierFlags & NSEventModifierFlagOption) != 0),
            @"ctrlKey": @((event.modifierFlags & NSEventModifierFlagControl) != 0),
            @"metaKey": @((event.modifierFlags & NSEventModifierFlagCommand) != 0)
        } mutableCopy];
        if (event.type == NSEventTypeMagnify) {
            payload[@"kind"] = @"zoom";
            payload[@"factor"] = @(MAX(0.05, MIN(20, 1 + event.magnification)));
        } else {
            payload[@"kind"] = @"wheel";
            payload[@"deltaX"] = @(-event.scrollingDeltaX);
            payload[@"deltaY"] = @(-event.scrollingDeltaY);
            payload[@"deltaMode"] = @0;
            payload[@"precise"] = @(event.hasPreciseScrollingDeltas);
        }
        NSData *data = [NSJSONSerialization dataWithJSONObject:payload options:0 error:nil];
        if (!data) return event;
        NSString *json = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
        NSString *script = [NSString stringWithFormat:
            @"(() => { const detail = %@; window.dispatchEvent(new CustomEvent('brickwright-camera-input', {detail})); return detail.handled === true; })()", json];
        [view evaluateJavaScript:script completionHandler:^(id handled, NSError *error) {
            BWEditorInputRouter *current = weakSelf;
            if (!current || (!error && [handled isKindOfClass:NSNumber.class] && [handled boolValue])) return;
            current.forwarding = YES;
            // Application-level redispatch from this asynchronous callback can
            // suppress WebKit panel scrolling. Preserve the original window.
            [event.window sendEvent:event];
            current.forwarding = NO;
        }];
        return nil;
    }];
}
- (void)dealloc {
    if (_monitor) [NSEvent removeMonitor:_monitor];
}
@end

void bw_install_editor_input(void *rawView) {
    WKWebView *view = (__bridge WKWebView *)rawView;
    static char association;
    if (!view || objc_getAssociatedObject(view, &association)) return;
    BWEditorInputRouter *router = [BWEditorInputRouter new];
    router.view = view;
    [router install];
    objc_setAssociatedObject(view, &association, router, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
}
