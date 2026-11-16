// React is supplied by the owning pane so the output uses its actual renderer.
// Visibility follows retained board text, not the current publication flag.
export function createArcadeStatsOutput(React,PropTypes) {
    function ArcadeStatsOutput({runtime}) {
        const text=runtime?.bwArcadeStatsText;
        return React.createElement('output',{
            'data-testid':'bw-arcade-stats',
            style:{display:'block',color:'#e2e8f0',fontFamily:'monospace',whiteSpace:'pre-wrap'}
        },typeof text==='string'?text:'');
    }
    ArcadeStatsOutput.propTypes={runtime:PropTypes.object.isRequired};
    return ArcadeStatsOutput;
}
