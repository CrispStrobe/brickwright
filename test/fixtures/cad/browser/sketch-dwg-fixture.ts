// SPDX-License-Identifier: BSD-3-Clause
import {ACadVersion,CadDocument,Circle,DwgWriter,Layer,Line,LwPolyline,LwPolylineVertex,XY,XYZ} from '@node-projects/acad-ts';

export function sketchDwgFixture({version=ACadVersion.AC1032,closed=true,units=1,extraLayers=true}={}){
 const document=new CadDocument();
 document.header!.version=version;
 document.header!.insUnits=units;
 const outline=new Layer('CUT');
 document.layers!.add(outline);
 const points=(closed?[[0,0],[2,0],[2,1],[0,1]]:[[0,0],[2,0],[2,1]])
  .map(([x,y])=>new LwPolylineVertex(new XY(x,y)));
 points[0].bulge=.25;
 points[0].startWidth=.1;
 points[0].endWidth=.2;
 const path=new LwPolyline(points);
 path.isClosed=closed;
 path.layer=outline;
 document.modelSpace!.entities.add(path);

 if(extraLayers){
  const guides=new Layer('GUIDES');
  document.layers!.add(guides);
  const line=new Line();
  line.startPoint=new XYZ(8,0,0);line.endPoint=new XYZ(9,0,0);line.layer=guides;
  document.modelSpace!.entities.add(line);
  const frame=new Circle();
  frame.center=new XYZ(3,4,0);frame.radius=3;frame.layer=outline;
  document.paperSpace!.entities.add(frame);
 }
 return DwgWriter.writeToBuffer(document);
}
