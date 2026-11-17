// SPDX-License-Identifier: BSD-3-Clause
// Standalone, ephemeral WKWebView. Exercises the actual AppKit input monitor
// with precise native wheel events; it never opens an existing user profile.
#import <AppKit/AppKit.h>
#import <WebKit/WebKit.h>
#import <CoreGraphics/CoreGraphics.h>
#import <unistd.h>
extern void bw_install_editor_input(void *view);
@interface InputProbe : NSObject <NSApplicationDelegate>
@property NSWindow *window;
@property WKWebView *view;
@property NSString *url;
@property NSDictionary *initial;
@property CGPoint oldPointer;
@property BOOL done;
@end
@implementation InputProbe
- (void)finish:(NSString *)error {
    if (self.done) return;self.done=YES;
    if (NSWorkspace.sharedWorkspace.frontmostApplication.processIdentifier==getpid()) {
        CGEventRef restore=CGEventCreateMouseEvent(NULL,kCGEventMouseMoved,self.oldPointer,kCGMouseButtonLeft);
        CGEventPost(kCGHIDEventTap,restore);CFRelease(restore);
    }
    if(error)fprintf(stderr,"FAIL %s\n",error.UTF8String);else if(getenv("BW_INPUT_BASELINE"))puts("PASS native baseline control: ordinary panel scroll works without the editor router");else puts("PASS native precise wheel reaches Blocks once; ordinary panel scrolling falls back once");
    [self.window close];exit(error?1:0);
}
- (void)applicationDidFinishLaunching:(NSNotification *)notification {
    CGEventRef current=CGEventCreate(NULL);self.oldPointer=CGEventGetLocation(current);CFRelease(current);
    WKWebViewConfiguration *config=[WKWebViewConfiguration new];config.websiteDataStore=WKWebsiteDataStore.nonPersistentDataStore;
    NSString *seed=@"localStorage.setItem('bw-starter-v1-complete','1');localStorage.setItem('bw-cad-enabled','1');window.__nativeInputs=[];window.addEventListener('brickwright-camera-input',e=>window.__nativeInputs.push(e.detail));";
    [config.userContentController addUserScript:[[WKUserScript alloc] initWithSource:seed injectionTime:WKUserScriptInjectionTimeAtDocumentStart forMainFrameOnly:YES]];
    self.view=[[WKWebView alloc] initWithFrame:NSMakeRect(0,0,1200,780) configuration:config];
    self.window=[[NSWindow alloc] initWithContentRect:NSMakeRect(70,40,1200,780) styleMask:NSWindowStyleMaskTitled|NSWindowStyleMaskClosable backing:NSBackingStoreBuffered defer:NO];
    self.window.title=@"Brickwright — isolated input verification";self.window.releasedWhenClosed=NO;self.window.contentView=self.view;
    if(!getenv("BW_INPUT_BASELINE"))bw_install_editor_input((__bridge void *)self.view);
    [self.window orderBack:nil];[self.view loadRequest:[NSURLRequest requestWithURL:[NSURL URLWithString:self.url]]];
    [self poll];
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW,120*NSEC_PER_SEC),dispatch_get_main_queue(),^{[self finish:@"Native input probe timed out"];});
}
- (void)poll {
    NSString *setup=@"(() => {const vm=window.__brickwrightStore?.getState().scratchGui.vm;if(!vm?.editingTarget)return null;let w;for(let n=document.querySelector('.blocklySvg');n&&!w;n=n.parentElement){const k=Object.keys(n).find(k=>/^__react(InternalInstance|Fiber)/.test(k));if(k)for(let f=n[k];f;f=f.return)if(f.stateNode?.workspace?.getMetrics){w=f.stateNode.workspace;break;}}if(!w||!w.isVisible())return null;if(!window.__nativeWorkspace){window.__nativeWorkspace=w;window.__nativeFixtureAt=performance.now();const b=w.newBlock('motion_movesteps');b.initSvg();b.render();b.moveBy(2400,2400);w.resizeContents();const m=w.getMetrics();w.startDragMetrics=m;w.scroll((m.viewWidth-2*m.contentLeft-m.contentWidth)/2,(m.viewHeight-2*m.contentTop-m.contentHeight)/2);}if(performance.now()-window.__nativeFixtureAt<1500)return null;const r=w.getParentSvg().getBoundingClientRect();return {x:r.x+r.width*.65,y:r.y+r.height*.5,scrollX:w.scrollX,scrollY:w.scrollY};})()";
    [self.view evaluateJavaScript:setup completionHandler:^(id value,NSError *error){
        if(self.done)return;
        if(error||![value isKindOfClass:NSDictionary.class]){dispatch_after(dispatch_time(DISPATCH_TIME_NOW,NSEC_PER_SEC/2),dispatch_get_main_queue(),^{[self poll];});return;}
        self.initial=value;
        [self.window makeKeyAndOrderFront:nil];[NSApp activateIgnoringOtherApps:YES];
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW,NSEC_PER_SEC/2),dispatch_get_main_queue(),^{
            [self scrollAtX:[value[@"x"] doubleValue] y:[value[@"y"] doubleValue] dx:-80 dy:-120];
            dispatch_after(dispatch_time(DISPATCH_TIME_NOW,NSEC_PER_SEC/2),dispatch_get_main_queue(),^{[self checkBlocks];});
        });
    }];
}
- (void)scrollAtX:(double)x y:(double)y dx:(int32_t)dx dy:(int32_t)dy {
    if(NSWorkspace.sharedWorkspace.frontmostApplication.processIdentifier!=getpid()){[self finish:@"Probe lost focus; no input was posted"];return;}
    NSPoint local=NSMakePoint(x,self.view.isFlipped?y:self.view.bounds.size.height-y);
    NSPoint screen=[self.window convertPointToScreen:[self.view convertPoint:local toView:nil]];
    CGPoint point=CGPointMake(screen.x,CGDisplayBounds(CGMainDisplayID()).size.height-screen.y);
    CGEventRef move=CGEventCreateMouseEvent(NULL,kCGEventMouseMoved,point,kCGMouseButtonLeft);CGEventPost(kCGHIDEventTap,move);CFRelease(move);
    CGEventRef wheel=CGEventCreateScrollWheelEvent(NULL,kCGScrollEventUnitPixel,2,dy,dx);
    CGEventSetLocation(wheel,point);CGEventSetIntegerValueField(wheel,kCGScrollWheelEventIsContinuous,1);
    CGEventPost(kCGHIDEventTap,wheel);CFRelease(wheel);
}
- (void)checkBlocks {
    NSString *read=@"({x:__nativeWorkspace.scrollX,y:__nativeWorkspace.scrollY,events:__nativeInputs.map(e=>({kind:e.kind,handled:e.handled,dx:e.deltaX,dy:e.deltaY})),pageScale:visualViewport.scale})";
    [self.view evaluateJavaScript:read completionHandler:^(id value,NSError *error){
        if(error||![value isKindOfClass:NSDictionary.class]){[self finish:error.localizedDescription?:@"Missing native Blocks state"];return;}
        puts([[value description] UTF8String]);puts([[self.initial description] UTF8String]);
        NSArray *events=value[@"events"];
        double dx=[value[@"x"] doubleValue]-[self.initial[@"scrollX"] doubleValue],dy=[value[@"y"] doubleValue]-[self.initial[@"scrollY"] doubleValue];
        if(!getenv("BW_INPUT_BASELINE")&&(events.count!=1||![events[0][@"handled"] boolValue]||fabs(dx+[events[0][@"dx"] doubleValue])>.5||fabs(dy+[events[0][@"dy"] doubleValue])>.5||fabs([value[@"pageScale"] doubleValue]-1)>.001)){[self finish:@"Native Blocks pan was missing or duplicated"];return;}
        NSString *panel=@"(() => {__nativeInputs.length=0;const p=document.createElement('div');p.id='native-input-panel';p.style.cssText='position:fixed;left:400px;top:350px;width:220px;height:140px;overflow:auto;background:white;z-index:999999';p.innerHTML='<div style=\"height:2000px\">Native ordinary scroll check</div>';document.body.append(p);p.scrollTop=300;const r=p.getBoundingClientRect();return {x:r.x+100,y:r.y+50};})()";
        [self.view evaluateJavaScript:panel completionHandler:^(id point,NSError *panelError){
            if(panelError){[self finish:panelError.localizedDescription];return;}
            dispatch_after(dispatch_time(DISPATCH_TIME_NOW,NSEC_PER_SEC/2),dispatch_get_main_queue(),^{
                [self scrollAtX:[point[@"x"] doubleValue] y:[point[@"y"] doubleValue] dx:0 dy:100];
                dispatch_after(dispatch_time(DISPATCH_TIME_NOW,NSEC_PER_SEC/2),dispatch_get_main_queue(),^{[self checkPanel];});
            });
        }];
    }];
}
- (void)checkPanel {
    [self.view evaluateJavaScript:@"({top:document.getElementById('native-input-panel').scrollTop,events:__nativeInputs.map(e=>({handled:e.handled===true,kind:e.kind}))})" completionHandler:^(id value,NSError *error){
        if(error||![value isKindOfClass:NSDictionary.class]){[self finish:error.localizedDescription?:@"Missing panel state"];return;}
        puts([[value description] UTF8String]);NSArray *events=value[@"events"];
        if((getenv("BW_INPUT_BASELINE")?events.count!=0:(events.count!=1||[events[0][@"handled"] boolValue]))||fabs([value[@"top"] doubleValue]-300)<1){[self finish:@"Unhandled native scrolling did not reach the panel exactly once"];return;}
        [self finish:nil];
    }];
}
@end
int main(int argc,const char **argv){@autoreleasepool{
    NSApplication *app=NSApplication.sharedApplication;[app setActivationPolicy:NSApplicationActivationPolicyRegular];
    InputProbe *probe=[InputProbe new];probe.url=argc>1?[NSString stringWithUTF8String:argv[1]]:@"http://127.0.0.1:8150/";
    app.delegate=probe;[app run];return 1;
}}
