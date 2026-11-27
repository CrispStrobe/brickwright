/**
 * A conversion publishes a report independently of its short status. Keep
 * both, plus earlier notices, until dismissed. Busy progress lives in the
 * operation's controls and does not add a history entry.
 */
export const collectCodeNotices = (state, visible) => {
    const status = state.busy && state.status !== state.noticedStatus ? '' : state.status;
    const report = state.conversionReport;
    const read = visible && state.showInfo;
    if (status === state.noticedStatus && report === state.noticedReport &&
        (!read || !state.codeNotices.some(notice => notice.unread))) return null;

    let id = state.codeNoticeId;
    const notices = read ? state.codeNotices.map(notice => ({...notice, unread: false})) : state.codeNotices.slice();
    if (status && status !== state.noticedStatus) {
        notices.unshift({id: ++id, status, offer: state.emptyTabOffer, unread: !read});
    }
    if (report && report !== state.noticedReport) {
        notices.unshift({id: ++id, report, unread: !read});
    }
    return {codeNotices: notices.slice(0, 100), codeNoticeId: id, noticedStatus: status, noticedReport: report};
};
