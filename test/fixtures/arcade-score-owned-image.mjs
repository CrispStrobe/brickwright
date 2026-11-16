import {encodeTileImage} from '../../overlay/scratch-gui/src/lib/bw-makecode/tile-assets.js';
// Original synthetic gallery and generated factory shape; no research sources.
export function scoreImageFiles(main='let hits=0;info.onScore(2,function(){hits+=1;scene.setBackgroundImage(assets.image`badge`)});info.setScore(2);'){
 const gallery={'*':{namespace:'myImages'},art:{data:encodeTileImage({width:2,height:2,pixels:Uint8Array.from([3,4,5,6])}),mimeType:'image/x-mkcd-f4',displayName:'badge'}};
 const image=`namespace myImages {
 helpers._registerFactory("image",function(name:string){switch(helpers.stringTrim(name)){case "art":case "badge":return img\`3 4\n5 6\`;}return null;});
 helpers._registerFactory("animation",function(name:string){switch(helpers.stringTrim(name)){}return null;});
 helpers._registerFactory("song",function(name:string){switch(helpers.stringTrim(name)){}return null;});
}`;
 return {'main.ts':main,'images.g.ts':image,'images.g.jres':JSON.stringify(gallery),'test.ts':'',
  'pxt.json':JSON.stringify({dependencies:{device:'*'},files:['images.g.ts','images.g.jres','main.ts'],testFiles:['test.ts']})};
}
