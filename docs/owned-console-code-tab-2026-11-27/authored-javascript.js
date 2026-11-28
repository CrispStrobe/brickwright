codeRun.spawn(async task => {
    console.log("saved-before");
    await task.sleep(25);
    console.log("saved-after");
});
// Authored source: this comment and Unicode Ω must survive save and reopen.
