// The one Plotly build for the whole site.
//
// Importing `react-plotly.js` directly pulls plotly's FULL distribution --
// 4.4 MB raw, 1.29 MB gzipped -- because that bundle also carries mapbox,
// d3-geo and the WebGL 3D stack. HEAP draws none of those. Building against
// plotly's core and registering only the traces we use cuts the download by
// more than half and changes nothing on screen.
//
// `scatter` is deliberately absent from the register call: it is the only
// trace plotly's core includes by default (see plotly.js/src/core.js), and
// registering it twice clobbers the module.
//
// ADDING A NEW CHART TYPE MEANS ADDING IT HERE. An unregistered trace type
// renders as an empty plot and logs nothing -- a silent failure, not a crash.
// The audit that produced this list is:
//   grep -rhoE "['\"]<tracename>['\"]" src/
// run across every plotly trace name; as of 2026-08-26 it returns exactly
// scatter, scattergl, bar, box, heatmap and pie.
import Plotly from 'plotly.js/lib/core';
import scattergl from 'plotly.js/lib/scattergl';
import bar from 'plotly.js/lib/bar';
import box from 'plotly.js/lib/box';
import heatmap from 'plotly.js/lib/heatmap';
import pie from 'plotly.js/lib/pie';
import createPlotlyComponent from 'react-plotly.js/factory';

Plotly.register([scattergl, bar, box, heatmap, pie]);

// Every chart on the site renders through this component. Nothing else should
// import `react-plotly.js` or `plotly.js` -- a second import would defeat the
// custom build and quietly restore the 1.29 MB download.
export default createPlotlyComponent(Plotly);
export { Plotly };
