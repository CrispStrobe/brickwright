(function dartProgram(){function copyProperties(a,b){var t=Object.keys(a)
for(var s=0;s<t.length;s++){var r=t[s]
b[r]=a[r]}}function mixinPropertiesHard(a,b){var t=Object.keys(a)
for(var s=0;s<t.length;s++){var r=t[s]
if(!b.hasOwnProperty(r)){b[r]=a[r]}}}function mixinPropertiesEasy(a,b){Object.assign(b,a)}var z=function(){var t=function(){}
t.prototype={p:{}}
var s=new t()
if(!(Object.getPrototypeOf(s)&&Object.getPrototypeOf(s).p===t.prototype.p))return false
try{if(typeof navigator!="undefined"&&typeof navigator.userAgent=="string"&&navigator.userAgent.indexOf("Chrome/")>=0)return true
if(typeof version=="function"&&version.length==0){var r=version()
if(/^\d+\.\d+\.\d+\.\d+$/.test(r))return true}}catch(q){}return false}()
function inherit(a,b){a.prototype.constructor=a
a.prototype["$i"+a.name]=a
if(b!=null){if(z){Object.setPrototypeOf(a.prototype,b.prototype)
return}var t=Object.create(b.prototype)
copyProperties(a.prototype,t)
a.prototype=t}}function inheritMany(a,b){for(var t=0;t<b.length;t++){inherit(b[t],a)}}function mixinEasy(a,b){mixinPropertiesEasy(b.prototype,a.prototype)
a.prototype.constructor=a}function mixinHard(a,b){mixinPropertiesHard(b.prototype,a.prototype)
a.prototype.constructor=a}function lazy(a,b,c,d){var t=a
a[b]=t
a[c]=function(){if(a[b]===t){a[b]=d()}a[c]=function(){return this[b]}
return a[b]}}function lazyFinal(a,b,c,d){var t=a
a[b]=t
a[c]=function(){if(a[b]===t){var s=d()
if(a[b]!==t){A.iv(b)}a[b]=s}var r=a[b]
a[c]=function(){return r}
return r}}function makeConstList(a,b){if(b!=null)A.d(a,b)
a.$flags=7
return a}function convertToFastObject(a){function t(){}t.prototype=a
new t()
return a}function convertAllToFastObject(a){for(var t=0;t<a.length;++t){convertToFastObject(a[t])}}var y=0
function instanceTearOffGetter(a,b){var t=null
return a?function(c){if(t===null)t=A.er(b)
return new t(c,this)}:function(){if(t===null)t=A.er(b)
return new t(this,null)}}function staticTearOffGetter(a){var t=null
return function(){if(t===null)t=A.er(a).prototype
return t}}var x=0
function tearOffParameters(a,b,c,d,e,f,g,h,i,j){if(typeof h=="number"){h+=x}return{co:a,iS:b,iI:c,rC:d,dV:e,cs:f,fs:g,fT:h,aI:i||0,nDA:j}}function installStaticTearOff(a,b,c,d,e,f,g,h){var t=tearOffParameters(a,true,false,c,d,e,f,g,h,false)
var s=staticTearOffGetter(t)
a[b]=s}function installInstanceTearOff(a,b,c,d,e,f,g,h,i,j){c=!!c
var t=tearOffParameters(a,false,c,d,e,f,g,h,i,!!j)
var s=instanceTearOffGetter(c,t)
a[b]=s}function setOrUpdateInterceptorsByTag(a){var t=v.interceptorsByTag
if(!t){v.interceptorsByTag=a
return}copyProperties(a,t)}function setOrUpdateLeafTags(a){var t=v.leafTags
if(!t){v.leafTags=a
return}copyProperties(a,t)}function updateTypes(a){var t=v.types
var s=t.length
t.push.apply(t,a)
return s}function updateHolder(a,b){copyProperties(b,a)
return a}var hunkHelpers=function(){var t=function(a,b,c,d,e){return function(f,g,h,i){return installInstanceTearOff(f,g,a,b,c,d,[h],i,e,false)}},s=function(a,b,c,d){return function(e,f,g,h){return installStaticTearOff(e,f,a,b,c,[g],h,d)}}
return{inherit:inherit,inheritMany:inheritMany,mixin:mixinEasy,mixinHard:mixinHard,installStaticTearOff:installStaticTearOff,installInstanceTearOff:installInstanceTearOff,_instance_0u:t(0,0,null,["$0"],0),_instance_1u:t(0,1,null,["$1"],0),_instance_2u:t(0,2,null,["$2"],0),_instance_0i:t(1,0,null,["$0"],0),_instance_1i:t(1,1,null,["$1"],0),_instance_2i:t(1,2,null,["$2"],0),_static_0:s(0,null,["$0"],0),_static_1:s(1,null,["$1"],0),_static_2:s(2,null,["$2"],0),makeConstList:makeConstList,lazy:lazy,lazyFinal:lazyFinal,updateHolder:updateHolder,convertToFastObject:convertToFastObject,updateTypes:updateTypes,setOrUpdateInterceptorsByTag:setOrUpdateInterceptorsByTag,setOrUpdateLeafTags:setOrUpdateLeafTags}}()
function initializeDeferredHunk(a){x=v.types.length
a(hunkHelpers,v,w,$)}var J={
ev(a,b,c,d){return{i:a,p:b,e:c,x:d}},
dT(a){var t,s,r,q,p,o=a[v.dispatchPropertyName]
if(o==null)if($.et==null){A.ii()
o=a[v.dispatchPropertyName]}if(o!=null){t=o.p
if(!1===t)return o.i
if(!0===t)return a
s=Object.getPrototypeOf(a)
if(t===s)return o.i
if(o.e===s)throw A.b(A.eX("Return interceptor for "+A.j(t(a,o))))}r=a.constructor
if(r==null)q=null
else{p=$.du
if(p==null)p=$.du=v.getIsolateTag("_$dart_js")
q=r[p]}if(q!=null)return q
q=A.io(a)
if(q!=null)return q
if(typeof a=="function")return B.W
t=Object.getPrototypeOf(a)
if(t==null)return B.z
if(t===Object.prototype)return B.z
if(typeof r=="function"){p=$.du
if(p==null)p=$.du=v.getIsolateTag("_$dart_js")
Object.defineProperty(r,p,{value:B.t,enumerable:false,writable:true,configurable:true})
return B.t}return B.t},
eL(a,b){if(a<0||a>4294967295)throw A.b(A.a8(a,0,4294967295,"length",null))
return J.h0(new Array(a),b)},
eM(a,b){if(a<0)throw A.b(A.l("Length must be a non-negative integer: "+a))
return A.d(new Array(a),b.h("i<0>"))},
cg(a,b){if(a<0)throw A.b(A.l("Length must be a non-negative integer: "+a))
return A.d(new Array(a),b.h("i<0>"))},
h0(a,b){var t=A.d(a,b.h("i<0>"))
t.$flags=1
return t},
aF(a){if(typeof a=="number"){if(Math.floor(a)==a)return J.bg.prototype
return J.ch.prototype}if(typeof a=="string")return J.aM.prototype
if(a==null)return J.bh.prototype
if(typeof a=="boolean")return J.bf.prototype
if(Array.isArray(a))return J.i.prototype
if(typeof a!="object"){if(typeof a=="function")return J.a4.prototype
if(typeof a=="symbol")return J.aP.prototype
if(typeof a=="bigint")return J.aN.prototype
return a}if(a instanceof A.q)return a
return J.dT(a)},
cC(a){if(typeof a=="string")return J.aM.prototype
if(a==null)return a
if(Array.isArray(a))return J.i.prototype
if(typeof a!="object"){if(typeof a=="function")return J.a4.prototype
if(typeof a=="symbol")return J.aP.prototype
if(typeof a=="bigint")return J.aN.prototype
return a}if(a instanceof A.q)return a
return J.dT(a)},
b_(a){if(a==null)return a
if(Array.isArray(a))return J.i.prototype
if(typeof a!="object"){if(typeof a=="function")return J.a4.prototype
if(typeof a=="symbol")return J.aP.prototype
if(typeof a=="bigint")return J.aN.prototype
return a}if(a instanceof A.q)return a
return J.dT(a)},
id(a){if(a==null)return a
if(typeof a!="object"){if(typeof a=="function")return J.a4.prototype
if(typeof a=="symbol")return J.aP.prototype
if(typeof a=="bigint")return J.aN.prototype
return a}if(a instanceof A.q)return a
return J.dT(a)},
aJ(a,b){if(a==null)return b==null
if(typeof a!="object")return b!=null&&a===b
return J.aF(a).N(a,b)},
t(a,b){if(typeof b==="number")if(Array.isArray(a)||typeof a=="string"||A.im(a,a[v.dispatchPropertyName]))if(b>>>0===b&&b<a.length)return a[b]
return J.cC(a).j(a,b)},
e4(a,b,c){return J.b_(a).l(a,b,c)},
bU(a,b){return J.b_(a).k(a,b)},
eA(a,b){return J.b_(a).H(a,b)},
fL(a,b,c,d){return J.id(a).T(a,b,c,d)},
S(a){return J.aF(a).gu(a)},
fM(a){return J.cC(a).gF(a)},
fN(a){return J.b_(a).gaT(a)},
b2(a){return J.b_(a).gq(a)},
D(a){return J.cC(a).gm(a)},
fO(a){return J.aF(a).gJ(a)},
fP(a,b,c){return J.b_(a).aU(a,b,c)},
fQ(a,b){return J.b_(a).aY(a,b)},
bV(a){return J.aF(a).i(a)},
ce:function ce(){},
bf:function bf(){},
bh:function bh(){},
bj:function bj(){},
ag:function ag(){},
cl:function cl(){},
bB:function bB(){},
a4:function a4(){},
aN:function aN(){},
aP:function aP(){},
i:function i(a){this.$ti=a},
cf:function cf(){},
d6:function d6(a){this.$ti=a},
ap:function ap(a,b,c){var _=this
_.a=a
_.b=b
_.c=0
_.d=null
_.$ti=c},
bi:function bi(){},
bg:function bg(){},
ch:function ch(){},
aM:function aM(){}},A={ea:function ea(){},
eO(a){return new A.aQ("Field '"+a+"' has been assigned during initialization.")},
h2(a){return new A.aQ("Field '"+a+"' has not been initialized.")},
h1(a){return new A.aQ("Field '"+a+"' has already been initialized.")},
ak(a,b){a=a+b&536870911
a=a+((a&524287)<<10)&536870911
return a^a>>>6},
eg(a){a=a+((a&67108863)<<3)&536870911
a^=a>>>11
return a+((a&16383)<<15)&536870911},
eq(a,b,c){return a},
eu(a){var t,s
for(t=$.R.length,s=0;s<t;++s)if(a===$.R[s])return!0
return!1},
dp(a,b,c,d){A.dk(b,"start")
if(c!=null){A.dk(c,"end")
if(b>c)A.V(A.a8(b,0,c,"start",null))}return new A.bz(a,b,c,d.h("bz<0>"))},
d5(){return new A.by("No element")},
aQ:function aQ(a){this.a=a},
dl:function dl(){},
b8:function b8(){},
Y:function Y(){},
bz:function bz(a,b,c,d){var _=this
_.a=a
_.b=b
_.c=c
_.$ti=d},
as:function as(a,b,c){var _=this
_.a=a
_.b=b
_.c=0
_.d=null
_.$ti=c},
a7:function a7(a,b,c){this.a=a
this.b=b
this.$ti=c},
aa:function aa(a,b,c){this.a=a
this.b=b
this.$ti=c},
bE:function bE(a,b,c){this.a=a
this.b=b
this.$ti=c},
W:function W(){},
eG(a,b,c){var t,s,r,q,p,o,n,m=A.r(a),l=A.bn(new A.O(a,m.h("O<1>")),!0,b),k=l.length,j=0
for(;;){if(!(j<k)){t=!0
break}s=l[j]
if(typeof s!="string"||"__proto__"===s){t=!1
break}++j}if(t){r={}
for(q=0,j=0;j<l.length;l.length===k||(0,A.h)(l),++j,q=p){s=l[j]
c.a(a.j(0,s))
p=q+1
r[s]=q}o=A.bn(new A.X(a,m.h("X<2>")),!0,c)
n=new A.b6(r,o,b.h("@<0>").D(c).h("b6<1,2>"))
n.$keys=l
return n}return new A.b4(A.h4(a,b,c),b.h("@<0>").D(c).h("b4<1,2>"))},
eH(){throw A.b(A.cu("Cannot modify constant Set"))},
fy(a){var t=v.mangledGlobalNames[a]
if(t!=null)return t
return"minified:"+a},
im(a,b){var t
if(b!=null){t=b.x
if(t!=null)return t}return u.da.b(a)},
j(a){var t
if(typeof a=="string")return a
if(typeof a=="number"){if(a!==0)return""+a}else if(!0===a)return"true"
else if(!1===a)return"false"
else if(a==null)return"null"
t=J.bV(a)
return t},
cm(a){var t,s=$.eS
if(s==null)s=$.eS=Symbol("identityHashCode")
t=a[s]
if(t==null){t=Math.random()*0x3fffffff|0
a[s]=t}return t},
cn(a){var t,s,r,q
if(a instanceof A.q)return A.J(A.G(a),null)
t=J.aF(a)
if(t===B.V||t===B.X||u.cr.b(a)){s=B.u(a)
if(s!=="Object"&&s!=="")return s
r=a.constructor
if(typeof r=="function"){q=r.name
if(typeof q=="string"&&q!=="Object"&&q!=="")return q}}return A.J(A.G(a),null)},
eT(a){var t,s,r
if(a==null||typeof a=="number"||A.en(a))return J.bV(a)
if(typeof a=="string")return JSON.stringify(a)
if(a instanceof A.H)return a.i(0)
if(a instanceof A.ay)return a.aO(!0)
t=$.fK()
for(s=0;s<1;++s){r=t[s].c3(a)
if(r!=null)return r}return"Instance of '"+A.cn(a)+"'"},
h6(){return Date.now()},
h7(){var t,s
if($.di!==0)return
$.di=1000
if(typeof window=="undefined")return
t=window
if(t==null)return
if(!!t.dartUseDateNowForTicks)return
s=t.performance
if(s==null)return
if(typeof s.now!="function")return
$.di=1e6
$.dj=new A.dh(s)},
B(a){var t
if(a<=65535)return String.fromCharCode(a)
if(a<=1114111){t=a-65536
return String.fromCharCode((B.f.aN(t,10)|55296)>>>0,t&1023|56320)}throw A.b(A.a8(a,0,1114111,null,null))},
aG(a){throw A.b(A.fp(a))},
a(a,b){if(a==null)J.D(a)
throw A.b(A.cB(a,b))},
cB(a,b){var t,s="index"
if(!A.fk(b))return new A.a2(!0,b,s,null)
t=A.y(J.D(a))
if(b<0||b>=t)return A.e7(b,t,a,s)
return A.h8(b,s)},
ia(a,b,c){if(a>c)return A.a8(a,0,c,"start",null)
if(b!=null)if(b<a||b>c)return A.a8(b,a,c,"end",null)
return new A.a2(!0,b,"end",null)},
fp(a){return new A.a2(!0,a,null,null)},
b(a){return A.w(a,new Error())},
w(a,b){var t
if(a==null)a=new A.bA()
b.dartException=a
t=A.ix
if("defineProperty" in Object){Object.defineProperty(b,"message",{get:t})
b.name=""}else b.toString=t
return b},
ix(){return J.bV(this.dartException)},
V(a,b){throw A.w(a,b==null?new Error():b)},
m(a,b,c){var t
if(b==null)b=0
if(c==null)c=0
t=Error()
A.V(A.hD(a,b,c),t)},
hD(a,b,c){var t,s,r,q,p,o,n,m,l
if(typeof b=="string")t=b
else{s="[]=;add;removeWhere;retainWhere;removeRange;setRange;setInt8;setInt16;setInt32;setUint8;setUint16;setUint32;setFloat32;setFloat64".split(";")
r=s.length
q=b
if(q>r){c=q/r|0
q%=r}t=s[q]}p=typeof c=="string"?c:"modify;remove from;add to".split(";")[c]
o=u.j.b(a)?"list":"ByteData"
n=a.$flags|0
m="a "
if((n&4)!==0)l="constant "
else if((n&2)!==0){l="unmodifiable "
m="an "}else l=(n&1)!==0?"fixed-length ":""
return new A.bD("'"+t+"': Cannot "+p+" "+m+l+o)},
h(a){throw A.b(A.T(a))},
a9(a){var t,s,r,q,p,o
a=A.it(a.replace(String({}),"$receiver$"))
t=a.match(/\\\$[a-zA-Z]+\\\$/g)
if(t==null)t=A.d([],u.s)
s=t.indexOf("\\$arguments\\$")
r=t.indexOf("\\$argumentsExpr\\$")
q=t.indexOf("\\$expr\\$")
p=t.indexOf("\\$method\\$")
o=t.indexOf("\\$receiver\\$")
return new A.dq(a.replace(new RegExp("\\\\\\$arguments\\\\\\$","g"),"((?:x|[^x])*)").replace(new RegExp("\\\\\\$argumentsExpr\\\\\\$","g"),"((?:x|[^x])*)").replace(new RegExp("\\\\\\$expr\\\\\\$","g"),"((?:x|[^x])*)").replace(new RegExp("\\\\\\$method\\\\\\$","g"),"((?:x|[^x])*)").replace(new RegExp("\\\\\\$receiver\\\\\\$","g"),"((?:x|[^x])*)"),s,r,q,p,o)},
dr(a){return function($expr$){var $argumentsExpr$="$arguments$"
try{$expr$.$method$($argumentsExpr$)}catch(t){return t.message}}(a)},
eW(a){return function($expr$){try{$expr$.$method$}catch(t){return t.message}}(a)},
eb(a,b){var t=b==null,s=t?null:b.method
return new A.ci(a,s,t?null:b.receiver)},
ex(a){if(a==null)return new A.dg(a)
if(typeof a!=="object")return a
if("dartException" in a)return A.aI(a,a.dartException)
return A.i6(a)},
aI(a,b){if(u.C.b(b))if(b.$thrownJsError==null)b.$thrownJsError=a
return b},
i6(a){var t,s,r,q,p,o,n,m,l,k,j,i,h
if(!("message" in a))return a
t=a.message
if("number" in a&&typeof a.number=="number"){s=a.number
r=s&65535
if((B.f.aN(s,16)&8191)===10)switch(r){case 438:return A.aI(a,A.eb(A.j(t)+" (Error "+r+")",null))
case 445:case 5007:A.j(t)
return A.aI(a,new A.bu())}}if(a instanceof TypeError){q=$.fA()
p=$.fB()
o=$.fC()
n=$.fD()
m=$.fG()
l=$.fH()
k=$.fF()
$.fE()
j=$.fJ()
i=$.fI()
h=q.I(t)
if(h!=null)return A.aI(a,A.eb(A.aD(t),h))
else{h=p.I(t)
if(h!=null){h.method="call"
return A.aI(a,A.eb(A.aD(t),h))}else if(o.I(t)!=null||n.I(t)!=null||m.I(t)!=null||l.I(t)!=null||k.I(t)!=null||n.I(t)!=null||j.I(t)!=null||i.I(t)!=null){A.aD(t)
return A.aI(a,new A.bu())}}return A.aI(a,new A.ct(typeof t=="string"?t:""))}if(a instanceof RangeError){if(typeof t=="string"&&t.indexOf("call stack")!==-1)return new A.bx()
t=function(b){try{return String(b)}catch(g){}return null}(a)
return A.aI(a,new A.a2(!1,null,null,typeof t=="string"?t.replace(/^RangeError:\s*/,""):t))}if(typeof InternalError=="function"&&a instanceof InternalError)if(typeof t=="string"&&t==="too much recursion")return new A.bx()
return a},
fv(a){if(a==null)return J.S(a)
if(typeof a=="object")return A.cm(a)
return J.S(a)},
ic(a,b){var t,s,r,q=a.length
for(t=0;t<q;t=r){s=t+1
r=s+1
b.l(0,a[t],a[s])}return b},
fX(a1){var t,s,r,q,p,o,n,m,l,k,j=a1.co,i=a1.iS,h=a1.iI,g=a1.nDA,f=a1.aI,e=a1.fs,d=a1.cs,c=e[0],b=d[0],a=j[c],a0=a1.fT
a0.toString
t=i?Object.create(new A.cq().constructor.prototype):Object.create(new A.aK(null,null).constructor.prototype)
t.$initialize=t.constructor
s=i?function static_tear_off(){this.$initialize()}:function tear_off(a2,a3){this.$initialize(a2,a3)}
t.constructor=s
s.prototype=t
t.$_name=c
t.$_target=a
r=!i
if(r)q=A.eF(c,a,h,g)
else{t.$static_name=c
q=a}t.$S=A.fT(a0,i,h)
t[b]=q
for(p=q,o=1;o<e.length;++o){n=e[o]
if(typeof n=="string"){m=j[n]
l=n
n=m}else l=""
k=d[o]
if(k!=null){if(r)n=A.eF(l,n,h,g)
t[k]=n}if(o===f)p=n}t.$C=p
t.$R=a1.rC
t.$D=a1.dV
return s},
fT(a,b,c){if(typeof a=="number")return a
if(typeof a=="string"){if(b)throw A.b("Cannot compute signature for static tearoff.")
return function(d,e){return function(){return e(this,d)}}(a,A.fR)}throw A.b("Error in functionType of tearoff")},
fU(a,b,c,d){var t=A.eE
switch(b?-1:a){case 0:return function(e,f){return function(){return f(this)[e]()}}(c,t)
case 1:return function(e,f){return function(g){return f(this)[e](g)}}(c,t)
case 2:return function(e,f){return function(g,h){return f(this)[e](g,h)}}(c,t)
case 3:return function(e,f){return function(g,h,i){return f(this)[e](g,h,i)}}(c,t)
case 4:return function(e,f){return function(g,h,i,j){return f(this)[e](g,h,i,j)}}(c,t)
case 5:return function(e,f){return function(g,h,i,j,k){return f(this)[e](g,h,i,j,k)}}(c,t)
default:return function(e,f){return function(){return e.apply(f(this),arguments)}}(d,t)}},
eF(a,b,c,d){if(c)return A.fW(a,b,d)
return A.fU(b.length,d,a,b)},
fV(a,b,c,d){var t=A.eE,s=A.fS
switch(b?-1:a){case 0:throw A.b(new A.co("Intercepted function with no arguments."))
case 1:return function(e,f,g){return function(){return f(this)[e](g(this))}}(c,s,t)
case 2:return function(e,f,g){return function(h){return f(this)[e](g(this),h)}}(c,s,t)
case 3:return function(e,f,g){return function(h,i){return f(this)[e](g(this),h,i)}}(c,s,t)
case 4:return function(e,f,g){return function(h,i,j){return f(this)[e](g(this),h,i,j)}}(c,s,t)
case 5:return function(e,f,g){return function(h,i,j,k){return f(this)[e](g(this),h,i,j,k)}}(c,s,t)
case 6:return function(e,f,g){return function(h,i,j,k,l){return f(this)[e](g(this),h,i,j,k,l)}}(c,s,t)
default:return function(e,f,g){return function(){var r=[g(this)]
Array.prototype.push.apply(r,arguments)
return e.apply(f(this),r)}}(d,s,t)}},
fW(a,b,c){var t,s
if($.eC==null)$.eC=A.eB("interceptor")
if($.eD==null)$.eD=A.eB("receiver")
t=b.length
s=A.fV(t,c,a,b)
return s},
er(a){return A.fX(a)},
fR(a,b){return A.bP(v.typeUniverse,A.G(a.a),b)},
eE(a){return a.a},
fS(a){return a.b},
eB(a){var t,s,r,q=new A.aK("receiver","interceptor"),p=Object.getOwnPropertyNames(q)
p.$flags=1
t=p
for(p=t.length,s=0;s<p;++s){r=t[s]
if(q[r]===a)return r}throw A.b(A.l("Field name "+a+" not found."))},
fr(a){return v.getIsolateTag(a)},
io(a){var t,s,r,q,p,o=A.aD($.fs.$1(a)),n=$.dS[o]
if(n!=null){Object.defineProperty(a,v.dispatchPropertyName,{value:n,enumerable:false,writable:true,configurable:true})
return n.i}t=$.dX[o]
if(t!=null)return t
s=v.interceptorsByTag[o]
if(s==null){r=A.ff($.fo.$2(a,o))
if(r!=null){n=$.dS[r]
if(n!=null){Object.defineProperty(a,v.dispatchPropertyName,{value:n,enumerable:false,writable:true,configurable:true})
return n.i}t=$.dX[r]
if(t!=null)return t
s=v.interceptorsByTag[r]
o=r}}if(s==null)return null
t=s.prototype
q=o[0]
if(q==="!"){n=A.dZ(t)
$.dS[o]=n
Object.defineProperty(a,v.dispatchPropertyName,{value:n,enumerable:false,writable:true,configurable:true})
return n.i}if(q==="~"){$.dX[o]=t
return t}if(q==="-"){p=A.dZ(t)
Object.defineProperty(Object.getPrototypeOf(a),v.dispatchPropertyName,{value:p,enumerable:false,writable:true,configurable:true})
return p.i}if(q==="+")return A.fw(a,t)
if(q==="*")throw A.b(A.eX(o))
if(v.leafTags[o]===true){p=A.dZ(t)
Object.defineProperty(Object.getPrototypeOf(a),v.dispatchPropertyName,{value:p,enumerable:false,writable:true,configurable:true})
return p.i}else return A.fw(a,t)},
fw(a,b){var t=Object.getPrototypeOf(a)
Object.defineProperty(t,v.dispatchPropertyName,{value:J.ev(b,t,null,null),enumerable:false,writable:true,configurable:true})
return b},
dZ(a){return J.ev(a,!1,null,!!a.$iaO)},
iq(a,b,c){var t=b.prototype
if(v.leafTags[a]===true)return A.dZ(t)
else return J.ev(t,c,null,null)},
ii(){if(!0===$.et)return
$.et=!0
A.ij()},
ij(){var t,s,r,q,p,o,n,m
$.dS=Object.create(null)
$.dX=Object.create(null)
A.ih()
t=v.interceptorsByTag
s=Object.getOwnPropertyNames(t)
if(typeof window!="undefined"){window
r=function(){}
for(q=0;q<s.length;++q){p=s[q]
o=$.fx.$1(p)
if(o!=null){n=A.iq(p,t[p],o)
if(n!=null){Object.defineProperty(o,v.dispatchPropertyName,{value:n,enumerable:false,writable:true,configurable:true})
r.prototype=o}}}}for(q=0;q<s.length;++q){p=s[q]
if(/^[A-Za-z_]/.test(p)){m=t[p]
t["!"+p]=m
t["~"+p]=m
t["-"+p]=m
t["+"+p]=m
t["*"+p]=m}}},
ih(){var t,s,r,q,p,o,n=B.D()
n=A.aZ(B.E,A.aZ(B.F,A.aZ(B.v,A.aZ(B.v,A.aZ(B.G,A.aZ(B.H,A.aZ(B.I(B.u),n)))))))
if(typeof dartNativeDispatchHooksTransformer!="undefined"){t=dartNativeDispatchHooksTransformer
if(typeof t=="function")t=[t]
if(Array.isArray(t))for(s=0;s<t.length;++s){r=t[s]
if(typeof r=="function")n=r(n)||n}}q=n.getTag
p=n.getUnknownTag
o=n.prototypeForTag
$.fs=new A.dU(q)
$.fo=new A.dV(p)
$.fx=new A.dW(o)},
aZ(a,b){return a(b)||b},
i9(a,b){var t=b.length,s=v.rttc[""+t+";"+a]
if(s==null)return null
if(t===0)return s
if(t===s.length)return s.apply(null,b)
return s(b)},
it(a){if(/[[\]{}()*+?.\\^$|]/.test(a))return a.replace(/[[\]{}()*+?.\\^$|]/g,"\\$&")
return a},
az:function az(a,b,c){this.a=a
this.b=b
this.c=c},
b4:function b4(a,b){this.a=a
this.$ti=b},
b3:function b3(){},
b6:function b6(a,b,c){this.a=a
this.b=b
this.$ti=c},
bF:function bF(a,b,c){var _=this
_.a=a
_.b=b
_.c=0
_.d=null
_.$ti=c},
b5:function b5(){},
b7:function b7(a,b,c){this.a=a
this.b=b
this.$ti=c},
cd:function cd(){},
aL:function aL(a,b){this.a=a
this.$ti=b},
dh:function dh(a){this.a=a},
bw:function bw(){},
dq:function dq(a,b,c,d,e,f){var _=this
_.a=a
_.b=b
_.c=c
_.d=d
_.e=e
_.f=f},
bu:function bu(){},
ci:function ci(a,b,c){this.a=a
this.b=b
this.c=c},
ct:function ct(a){this.a=a},
dg:function dg(a){this.a=a},
H:function H(){},
bZ:function bZ(){},
c_:function c_(){},
cr:function cr(){},
cq:function cq(){},
aK:function aK(a,b){this.a=a
this.b=b},
co:function co(a){this.a=a},
a5:function a5(a){var _=this
_.a=0
_.f=_.e=_.d=_.c=_.b=null
_.r=0
_.$ti=a},
da:function da(a,b){this.a=a
this.b=b
this.c=null},
O:function O(a,b){this.a=a
this.$ti=b},
bl:function bl(a,b,c,d){var _=this
_.a=a
_.b=b
_.c=c
_.d=null
_.$ti=d},
X:function X(a,b){this.a=a
this.$ti=b},
bm:function bm(a,b,c,d){var _=this
_.a=a
_.b=b
_.c=c
_.d=null
_.$ti=d},
dU:function dU(a){this.a=a},
dV:function dV(a){this.a=a},
dW:function dW(a){this.a=a},
ay:function ay(){},
aV:function aV(){},
F(a){return a},
h5(a){return new Float64Array(a)},
ek(a,b,c){if(a>>>0!==a||a>=c)throw A.b(A.cB(b,a))},
hB(a,b,c){var t
if(!(a>>>0!==a))t=b>>>0!==b||a>b||b>c
else t=!0
if(t)throw A.b(A.ia(a,b,c))
return b},
aS:function aS(){},
bs:function bs(){},
a0:function a0(){},
bq:function bq(){},
br:function br(){},
bo:function bo(){},
bp:function bp(){},
bG:function bG(){},
bH:function bH(){},
bI:function bI(){},
bJ:function bJ(){},
ef(a,b){var t=b.c
return t==null?b.c=A.bN(a,"eJ",[b.x]):t},
eU(a){var t=a.w
if(t===6||t===7)return A.eU(a.x)
return t===11||t===12},
h9(a){return a.as},
bT(a){return A.dJ(v.typeUniverse,a,!1)},
il(a,b){var t,s,r,q,p
if(a==null)return null
t=b.y
s=a.Q
if(s==null)s=a.Q=new Map()
r=b.as
q=s.get(r)
if(q!=null)return q
p=A.ao(v.typeUniverse,a.x,t,0)
s.set(r,p)
return p},
ao(a0,a1,a2,a3){var t,s,r,q,p,o,n,m,l,k,j,i,h,g,f,e,d,c,b,a=a1.w
switch(a){case 5:case 1:case 2:case 3:case 4:return a1
case 6:t=a1.x
s=A.ao(a0,t,a2,a3)
if(s===t)return a1
return A.f7(a0,s,!0)
case 7:t=a1.x
s=A.ao(a0,t,a2,a3)
if(s===t)return a1
return A.f6(a0,s,!0)
case 8:r=a1.y
q=A.aY(a0,r,a2,a3)
if(q===r)return a1
return A.bN(a0,a1.x,q)
case 9:p=a1.x
o=A.ao(a0,p,a2,a3)
n=a1.y
m=A.aY(a0,n,a2,a3)
if(o===p&&m===n)return a1
return A.ei(a0,o,m)
case 10:l=a1.x
k=a1.y
j=A.aY(a0,k,a2,a3)
if(j===k)return a1
return A.f8(a0,l,j)
case 11:i=a1.x
h=A.ao(a0,i,a2,a3)
g=a1.y
f=A.i3(a0,g,a2,a3)
if(h===i&&f===g)return a1
return A.f5(a0,h,f)
case 12:e=a1.y
a3+=e.length
d=A.aY(a0,e,a2,a3)
p=a1.x
o=A.ao(a0,p,a2,a3)
if(d===e&&o===p)return a1
return A.ej(a0,o,d,!0)
case 13:c=a1.x
if(c<a3)return a1
b=a2[c-a3]
if(b==null)return a1
return b
default:throw A.b(A.bY("Attempted to substitute unexpected RTI kind "+a))}},
aY(a,b,c,d){var t,s,r,q,p=b.length,o=A.dK(p)
for(t=!1,s=0;s<p;++s){r=b[s]
q=A.ao(a,r,c,d)
if(q!==r)t=!0
o[s]=q}return t?o:b},
i4(a,b,c,d){var t,s,r,q,p,o,n=b.length,m=A.dK(n)
for(t=!1,s=0;s<n;s+=3){r=b[s]
q=b[s+1]
p=b[s+2]
o=A.ao(a,p,c,d)
if(o!==p)t=!0
m.splice(s,3,r,q,o)}return t?m:b},
i3(a,b,c,d){var t,s=b.a,r=A.aY(a,s,c,d),q=b.b,p=A.aY(a,q,c,d),o=b.c,n=A.i4(a,o,c,d)
if(r===s&&p===q&&n===o)return b
t=new A.cw()
t.a=r
t.b=p
t.c=n
return t},
d(a,b){a[v.arrayRti]=b
return a},
dR(a){var t=a.$S
if(t!=null){if(typeof t=="number")return A.ig(t)
return a.$S()}return null},
ik(a,b){var t
if(A.eU(b))if(a instanceof A.H){t=A.dR(a)
if(t!=null)return t}return A.G(a)},
G(a){if(a instanceof A.q)return A.r(a)
if(Array.isArray(a))return A.C(a)
return A.em(J.aF(a))},
C(a){var t=a[v.arrayRti],s=u.b
if(t==null)return s
if(t.constructor!==s.constructor)return s
return t},
r(a){var t=a.$ti
return t!=null?t:A.em(a)},
em(a){var t=a.constructor,s=t.$ccache
if(s!=null)return s
return A.hK(a,t)},
hK(a,b){var t=a instanceof A.H?Object.getPrototypeOf(Object.getPrototypeOf(a)).constructor:b,s=A.hs(v.typeUniverse,t.name)
b.$ccache=s
return s},
ig(a){var t,s=v.types,r=s[a]
if(typeof r=="string"){t=A.dJ(v.typeUniverse,r,!1)
s[a]=t
return t}return r},
ie(a){return A.ab(A.r(a))},
es(a){var t=A.dR(a)
return A.ab(t==null?A.G(a):t)},
ep(a){var t
if(a instanceof A.ay)return A.ib(a.$r,a.aG())
t=a instanceof A.H?A.dR(a):null
if(t!=null)return t
if(u.R.b(a))return J.fO(a).a
if(Array.isArray(a))return A.C(a)
return A.G(a)},
ab(a){var t=a.r
return t==null?a.r=new A.dI(a):t},
ib(a,b){var t,s,r=b,q=r.length
if(q===0)return u.cD
if(0>=q)return A.a(r,0)
t=A.bP(v.typeUniverse,A.ep(r[0]),"@<0>")
for(s=1;s<q;++s){if(!(s<r.length))return A.a(r,s)
t=A.f9(v.typeUniverse,t,A.ep(r[s]))}return A.bP(v.typeUniverse,t,a)},
e2(a){return A.ab(A.dJ(v.typeUniverse,a,!1))},
hJ(a){var t=this
t.b=A.i2(t)
return t.b(a)},
i2(a){var t,s,r,q,p
if(a===u.K)return A.hQ
if(A.aH(a))return A.hU
t=a.w
if(t===6)return A.hH
if(t===1)return A.fm
if(t===7)return A.hL
s=A.i0(a)
if(s!=null)return s
if(t===8){r=a.x
if(a.y.every(A.aH)){a.f="$i"+r
if(r==="f")return A.hO
if(a===u.m)return A.hN
return A.hT}}else if(t===10){q=A.i9(a.x,a.y)
p=q==null?A.fm:q
return p==null?A.fe(p):p}return A.hF},
i0(a){if(a.w===8){if(a===u.S)return A.fk
if(a===u.i||a===u.H)return A.hP
if(a===u.N)return A.hS
if(a===u.y)return A.en}return null},
hI(a){var t=this,s=A.hE
if(A.aH(t))s=A.hz
else if(t===u.K)s=A.fe
else if(A.b0(t)){s=A.hG
if(t===u.a3)s=A.hw
else if(t===u.aD)s=A.ff
else if(t===u.cG)s=A.hu
else if(t===u.ae)s=A.fd
else if(t===u.I)s=A.hv
else if(t===u.aQ)s=A.hy}else if(t===u.S)s=A.y
else if(t===u.N)s=A.aD
else if(t===u.y)s=A.fc
else if(t===u.H)s=A.bS
else if(t===u.i)s=A.aC
else if(t===u.m)s=A.hx
t.a=s
return t.a(a)},
hF(a){var t=this
if(a==null)return A.b0(t)
return A.ft(v.typeUniverse,A.ik(a,t),t)},
hH(a){if(a==null)return!0
return this.x.b(a)},
hT(a){var t,s=this
if(a==null)return A.b0(s)
t=s.f
if(a instanceof A.q)return!!a[t]
return!!J.aF(a)[t]},
hO(a){var t,s=this
if(a==null)return A.b0(s)
if(typeof a!="object")return!1
if(Array.isArray(a))return!0
t=s.f
if(a instanceof A.q)return!!a[t]
return!!J.aF(a)[t]},
hN(a){var t=this
if(a==null)return!1
if(typeof a=="object"){if(a instanceof A.q)return!!a[t.f]
return!0}if(typeof a=="function")return!0
return!1},
fl(a){if(typeof a=="object"){if(a instanceof A.q)return u.m.b(a)
return!0}if(typeof a=="function")return!0
return!1},
hE(a){var t=this
if(a==null){if(A.b0(t))return a}else if(t.b(a))return a
throw A.w(A.fg(a,t),new Error())},
hG(a){var t=this
if(a==null||t.b(a))return a
throw A.w(A.fg(a,t),new Error())},
fg(a,b){return new A.aW("TypeError: "+A.eY(a,A.J(b,null)))},
i7(a,b,c,d){if(A.ft(v.typeUniverse,a,b))return a
throw A.w(A.hk("The type argument '"+A.J(a,null)+"' is not a subtype of the type variable bound '"+A.J(b,null)+"' of type variable '"+c+"' in '"+d+"'."),new Error())},
eY(a,b){return A.c5(a)+": type '"+A.J(A.ep(a),null)+"' is not a subtype of type '"+b+"'"},
hk(a){return new A.aW("TypeError: "+a)},
U(a,b){return new A.aW("TypeError: "+A.eY(a,b))},
hL(a){var t=this
return t.x.b(a)||A.ef(v.typeUniverse,t).b(a)},
hQ(a){return a!=null},
fe(a){if(a!=null)return a
throw A.w(A.U(a,"Object"),new Error())},
hU(a){return!0},
hz(a){return a},
fm(a){return!1},
en(a){return!0===a||!1===a},
fc(a){if(!0===a)return!0
if(!1===a)return!1
throw A.w(A.U(a,"bool"),new Error())},
hu(a){if(!0===a)return!0
if(!1===a)return!1
if(a==null)return a
throw A.w(A.U(a,"bool?"),new Error())},
aC(a){if(typeof a=="number")return a
throw A.w(A.U(a,"double"),new Error())},
hv(a){if(typeof a=="number")return a
if(a==null)return a
throw A.w(A.U(a,"double?"),new Error())},
fk(a){return typeof a=="number"&&Math.floor(a)===a},
y(a){if(typeof a=="number"&&Math.floor(a)===a)return a
throw A.w(A.U(a,"int"),new Error())},
hw(a){if(typeof a=="number"&&Math.floor(a)===a)return a
if(a==null)return a
throw A.w(A.U(a,"int?"),new Error())},
hP(a){return typeof a=="number"},
bS(a){if(typeof a=="number")return a
throw A.w(A.U(a,"num"),new Error())},
fd(a){if(typeof a=="number")return a
if(a==null)return a
throw A.w(A.U(a,"num?"),new Error())},
hS(a){return typeof a=="string"},
aD(a){if(typeof a=="string")return a
throw A.w(A.U(a,"String"),new Error())},
ff(a){if(typeof a=="string")return a
if(a==null)return a
throw A.w(A.U(a,"String?"),new Error())},
hx(a){if(A.fl(a))return a
throw A.w(A.U(a,"JSObject"),new Error())},
hy(a){if(a==null)return a
if(A.fl(a))return a
throw A.w(A.U(a,"JSObject?"),new Error())},
fn(a,b){var t,s,r
for(t="",s="",r=0;r<a.length;++r,s=", ")t+=s+A.J(a[r],b)
return t},
hZ(a,b){var t,s,r,q,p,o,n=a.x,m=a.y
if(""===n)return"("+A.fn(m,b)+")"
t=m.length
s=n.split(",")
r=s.length-t
for(q="(",p="",o=0;o<t;++o,p=", "){q+=p
if(r===0)q+="{"
q+=A.J(m[o],b)
if(r>=0)q+=" "+s[r];++r}return q+"})"},
fi(a2,a3,a4){var t,s,r,q,p,o,n,m,l,k,j,i,h,g,f,e,d,c,b,a,a0=", ",a1=null
if(a4!=null){t=a4.length
if(a3==null)a3=A.d([],u.s)
else a1=a3.length
s=a3.length
for(r=t;r>0;--r)B.a.k(a3,"T"+(s+r))
for(q=u.X,p="<",o="",r=0;r<t;++r,o=a0){n=a3.length
m=n-1-r
if(!(m>=0))return A.a(a3,m)
p=p+o+a3[m]
l=a4[r]
k=l.w
if(!(k===2||k===3||k===4||k===5||l===q))p+=" extends "+A.J(l,a3)}p+=">"}else p=""
q=a2.x
j=a2.y
i=j.a
h=i.length
g=j.b
f=g.length
e=j.c
d=e.length
c=A.J(q,a3)
for(b="",a="",r=0;r<h;++r,a=a0)b+=a+A.J(i[r],a3)
if(f>0){b+=a+"["
for(a="",r=0;r<f;++r,a=a0)b+=a+A.J(g[r],a3)
b+="]"}if(d>0){b+=a+"{"
for(a="",r=0;r<d;r+=3,a=a0){b+=a
if(e[r+1])b+="required "
b+=A.J(e[r+2],a3)+" "+e[r]}b+="}"}if(a1!=null){a3.toString
a3.length=a1}return p+"("+b+") => "+c},
J(a,b){var t,s,r,q,p,o,n,m=a.w
if(m===5)return"erased"
if(m===2)return"dynamic"
if(m===3)return"void"
if(m===1)return"Never"
if(m===4)return"any"
if(m===6){t=a.x
s=A.J(t,b)
r=t.w
return(r===11||r===12?"("+s+")":s)+"?"}if(m===7)return"FutureOr<"+A.J(a.x,b)+">"
if(m===8){q=A.i5(a.x)
p=a.y
return p.length>0?q+("<"+A.fn(p,b)+">"):q}if(m===10)return A.hZ(a,b)
if(m===11)return A.fi(a,b,null)
if(m===12)return A.fi(a.x,b,a.y)
if(m===13){o=a.x
n=b.length
o=n-1-o
if(!(o>=0&&o<n))return A.a(b,o)
return b[o]}return"?"},
i5(a){var t=v.mangledGlobalNames[a]
if(t!=null)return t
return"minified:"+a},
ht(a,b){var t=a.tR[b]
while(typeof t=="string")t=a.tR[t]
return t},
hs(a,b){var t,s,r,q,p,o=a.eT,n=o[b]
if(n==null)return A.dJ(a,b,!1)
else if(typeof n=="number"){t=n
s=A.bO(a,5,"#")
r=A.dK(t)
for(q=0;q<t;++q)r[q]=s
p=A.bN(a,b,r)
o[b]=p
return p}else return n},
hr(a,b){return A.fa(a.tR,b)},
hq(a,b){return A.fa(a.eT,b)},
dJ(a,b,c){var t,s=a.eC,r=s.get(b)
if(r!=null)return r
t=A.f2(A.f0(a,null,b,!1))
s.set(b,t)
return t},
bP(a,b,c){var t,s,r=b.z
if(r==null)r=b.z=new Map()
t=r.get(c)
if(t!=null)return t
s=A.f2(A.f0(a,b,c,!0))
r.set(c,s)
return s},
f9(a,b,c){var t,s,r,q=b.Q
if(q==null)q=b.Q=new Map()
t=c.as
s=q.get(t)
if(s!=null)return s
r=A.ei(a,b,c.w===9?c.y:[c])
q.set(t,r)
return r},
an(a,b){b.a=A.hI
b.b=A.hJ
return b},
bO(a,b,c){var t,s,r=a.eC.get(c)
if(r!=null)return r
t=new A.Z(null,null)
t.w=b
t.as=c
s=A.an(a,t)
a.eC.set(c,s)
return s},
f7(a,b,c){var t,s=b.as+"?",r=a.eC.get(s)
if(r!=null)return r
t=A.ho(a,b,s,c)
a.eC.set(s,t)
return t},
ho(a,b,c,d){var t,s,r
if(d){t=b.w
s=!0
if(!A.aH(b))if(!(b===u.P||b===u.T))if(t!==6)s=t===7&&A.b0(b.x)
if(s)return b
else if(t===1)return u.P}r=new A.Z(null,null)
r.w=6
r.x=b
r.as=c
return A.an(a,r)},
f6(a,b,c){var t,s=b.as+"/",r=a.eC.get(s)
if(r!=null)return r
t=A.hm(a,b,s,c)
a.eC.set(s,t)
return t},
hm(a,b,c,d){var t,s
if(d){t=b.w
if(A.aH(b)||b===u.K)return b
else if(t===1)return A.bN(a,"eJ",[b])
else if(b===u.P||b===u.T)return u.bc}s=new A.Z(null,null)
s.w=7
s.x=b
s.as=c
return A.an(a,s)},
hp(a,b){var t,s,r=""+b+"^",q=a.eC.get(r)
if(q!=null)return q
t=new A.Z(null,null)
t.w=13
t.x=b
t.as=r
s=A.an(a,t)
a.eC.set(r,s)
return s},
bM(a){var t,s,r,q=a.length
for(t="",s="",r=0;r<q;++r,s=",")t+=s+a[r].as
return t},
hl(a){var t,s,r,q,p,o=a.length
for(t="",s="",r=0;r<o;r+=3,s=","){q=a[r]
p=a[r+1]?"!":":"
t+=s+q+p+a[r+2].as}return t},
bN(a,b,c){var t,s,r,q=b
if(c.length>0)q+="<"+A.bM(c)+">"
t=a.eC.get(q)
if(t!=null)return t
s=new A.Z(null,null)
s.w=8
s.x=b
s.y=c
if(c.length>0)s.c=c[0]
s.as=q
r=A.an(a,s)
a.eC.set(q,r)
return r},
ei(a,b,c){var t,s,r,q,p,o
if(b.w===9){t=b.x
s=b.y.concat(c)}else{s=c
t=b}r=t.as+(";<"+A.bM(s)+">")
q=a.eC.get(r)
if(q!=null)return q
p=new A.Z(null,null)
p.w=9
p.x=t
p.y=s
p.as=r
o=A.an(a,p)
a.eC.set(r,o)
return o},
f8(a,b,c){var t,s,r="+"+(b+"("+A.bM(c)+")"),q=a.eC.get(r)
if(q!=null)return q
t=new A.Z(null,null)
t.w=10
t.x=b
t.y=c
t.as=r
s=A.an(a,t)
a.eC.set(r,s)
return s},
f5(a,b,c){var t,s,r,q,p,o=b.as,n=c.a,m=n.length,l=c.b,k=l.length,j=c.c,i=j.length,h="("+A.bM(n)
if(k>0){t=m>0?",":""
h+=t+"["+A.bM(l)+"]"}if(i>0){t=m>0?",":""
h+=t+"{"+A.hl(j)+"}"}s=o+(h+")")
r=a.eC.get(s)
if(r!=null)return r
q=new A.Z(null,null)
q.w=11
q.x=b
q.y=c
q.as=s
p=A.an(a,q)
a.eC.set(s,p)
return p},
ej(a,b,c,d){var t,s=b.as+("<"+A.bM(c)+">"),r=a.eC.get(s)
if(r!=null)return r
t=A.hn(a,b,c,s,d)
a.eC.set(s,t)
return t},
hn(a,b,c,d,e){var t,s,r,q,p,o,n,m
if(e){t=c.length
s=A.dK(t)
for(r=0,q=0;q<t;++q){p=c[q]
if(p.w===1){s[q]=p;++r}}if(r>0){o=A.ao(a,b,s,0)
n=A.aY(a,c,s,0)
return A.ej(a,o,n,c!==n)}}m=new A.Z(null,null)
m.w=12
m.x=b
m.y=c
m.as=d
return A.an(a,m)},
f0(a,b,c,d){return{u:a,e:b,r:c,s:[],p:0,n:d}},
f2(a){var t,s,r,q,p,o,n,m=a.r,l=a.s
for(t=m.length,s=0;s<t;){r=m.charCodeAt(s)
if(r>=48&&r<=57)s=A.hf(s+1,r,m,l)
else if((((r|32)>>>0)-97&65535)<26||r===95||r===36||r===124)s=A.f1(a,s,m,l,!1)
else if(r===46)s=A.f1(a,s,m,l,!0)
else{++s
switch(r){case 44:break
case 58:l.push(!1)
break
case 33:l.push(!0)
break
case 59:l.push(A.ax(a.u,a.e,l.pop()))
break
case 94:l.push(A.hp(a.u,l.pop()))
break
case 35:l.push(A.bO(a.u,5,"#"))
break
case 64:l.push(A.bO(a.u,2,"@"))
break
case 126:l.push(A.bO(a.u,3,"~"))
break
case 60:l.push(a.p)
a.p=l.length
break
case 62:A.hh(a,l)
break
case 38:A.hg(a,l)
break
case 63:q=a.u
l.push(A.f7(q,A.ax(q,a.e,l.pop()),a.n))
break
case 47:q=a.u
l.push(A.f6(q,A.ax(q,a.e,l.pop()),a.n))
break
case 40:l.push(-3)
l.push(a.p)
a.p=l.length
break
case 41:A.he(a,l)
break
case 91:l.push(a.p)
a.p=l.length
break
case 93:p=l.splice(a.p)
A.f3(a.u,a.e,p)
a.p=l.pop()
l.push(p)
l.push(-1)
break
case 123:l.push(a.p)
a.p=l.length
break
case 125:p=l.splice(a.p)
A.hj(a.u,a.e,p)
a.p=l.pop()
l.push(p)
l.push(-2)
break
case 43:o=m.indexOf("(",s)
l.push(m.substring(s,o))
l.push(-4)
l.push(a.p)
a.p=l.length
s=o+1
break
default:throw"Bad character "+r}}}n=l.pop()
return A.ax(a.u,a.e,n)},
hf(a,b,c,d){var t,s,r=b-48
for(t=c.length;a<t;++a){s=c.charCodeAt(a)
if(!(s>=48&&s<=57))break
r=r*10+(s-48)}d.push(r)
return a},
f1(a,b,c,d,e){var t,s,r,q,p,o,n=b+1
for(t=c.length;n<t;++n){s=c.charCodeAt(n)
if(s===46){if(e)break
e=!0}else{if(!((((s|32)>>>0)-97&65535)<26||s===95||s===36||s===124))r=s>=48&&s<=57
else r=!0
if(!r)break}}q=c.substring(b,n)
if(e){t=a.u
p=a.e
if(p.w===9)p=p.x
o=A.ht(t,p.x)[q]
if(o==null)A.V('No "'+q+'" in "'+A.h9(p)+'"')
d.push(A.bP(t,p,o))}else d.push(q)
return n},
hh(a,b){var t,s=a.u,r=A.f_(a,b),q=b.pop()
if(typeof q=="string")b.push(A.bN(s,q,r))
else{t=A.ax(s,a.e,q)
switch(t.w){case 11:b.push(A.ej(s,t,r,a.n))
break
default:b.push(A.ei(s,t,r))
break}}},
he(a,b){var t,s,r,q=a.u,p=b.pop(),o=null,n=null
if(typeof p=="number")switch(p){case-1:o=b.pop()
break
case-2:n=b.pop()
break
default:b.push(p)
break}else b.push(p)
t=A.f_(a,b)
p=b.pop()
switch(p){case-3:p=b.pop()
if(o==null)o=q.sEA
if(n==null)n=q.sEA
s=A.ax(q,a.e,p)
r=new A.cw()
r.a=t
r.b=o
r.c=n
b.push(A.f5(q,s,r))
return
case-4:b.push(A.f8(q,b.pop(),t))
return
default:throw A.b(A.bY("Unexpected state under `()`: "+A.j(p)))}},
hg(a,b){var t=b.pop()
if(0===t){b.push(A.bO(a.u,1,"0&"))
return}if(1===t){b.push(A.bO(a.u,4,"1&"))
return}throw A.b(A.bY("Unexpected extended operation "+A.j(t)))},
f_(a,b){var t=b.splice(a.p)
A.f3(a.u,a.e,t)
a.p=b.pop()
return t},
ax(a,b,c){if(typeof c=="string")return A.bN(a,c,a.sEA)
else if(typeof c=="number"){b.toString
return A.hi(a,b,c)}else return c},
f3(a,b,c){var t,s=c.length
for(t=0;t<s;++t)c[t]=A.ax(a,b,c[t])},
hj(a,b,c){var t,s=c.length
for(t=2;t<s;t+=3)c[t]=A.ax(a,b,c[t])},
hi(a,b,c){var t,s,r=b.w
if(r===9){if(c===0)return b.x
t=b.y
s=t.length
if(c<=s)return t[c-1]
c-=s
b=b.x
r=b.w}else if(c===0)return b
if(r!==8)throw A.b(A.bY("Indexed base must be an interface type"))
t=b.y
if(c<=t.length)return t[c-1]
throw A.b(A.bY("Bad index "+c+" for "+b.i(0)))},
ft(a,b,c){var t,s=b.d
if(s==null)s=b.d=new Map()
t=s.get(c)
if(t==null){t=A.x(a,b,null,c,null)
s.set(c,t)}return t},
x(a,b,c,d,e){var t,s,r,q,p,o,n,m,l,k,j
if(b===d)return!0
if(A.aH(d))return!0
t=b.w
if(t===4)return!0
if(A.aH(b))return!1
if(b.w===1)return!0
s=t===13
if(s)if(A.x(a,c[b.x],c,d,e))return!0
r=d.w
q=u.P
if(b===q||b===u.T){if(r===7)return A.x(a,b,c,d.x,e)
return d===q||d===u.T||r===6}if(d===u.K){if(t===7)return A.x(a,b.x,c,d,e)
return t!==6}if(t===7){if(!A.x(a,b.x,c,d,e))return!1
return A.x(a,A.ef(a,b),c,d,e)}if(t===6)return A.x(a,q,c,d,e)&&A.x(a,b.x,c,d,e)
if(r===7){if(A.x(a,b,c,d.x,e))return!0
return A.x(a,b,c,A.ef(a,d),e)}if(r===6)return A.x(a,b,c,q,e)||A.x(a,b,c,d.x,e)
if(s)return!1
q=t!==11
if((!q||t===12)&&d===u.Z)return!0
p=t===10
if(p&&d===u.cY)return!0
if(r===12){if(b===u.L)return!0
if(t!==12)return!1
o=b.y
n=d.y
m=o.length
if(m!==n.length)return!1
c=c==null?o:o.concat(c)
e=e==null?n:n.concat(e)
for(l=0;l<m;++l){k=o[l]
j=n[l]
if(!A.x(a,k,c,j,e)||!A.x(a,j,e,k,c))return!1}return A.fj(a,b.x,c,d.x,e)}if(r===11){if(b===u.L)return!0
if(q)return!1
return A.fj(a,b,c,d,e)}if(t===8){if(r!==8)return!1
return A.hM(a,b,c,d,e)}if(p&&r===10)return A.hR(a,b,c,d,e)
return!1},
fj(a2,a3,a4,a5,a6){var t,s,r,q,p,o,n,m,l,k,j,i,h,g,f,e,d,c,b,a,a0,a1
if(!A.x(a2,a3.x,a4,a5.x,a6))return!1
t=a3.y
s=a5.y
r=t.a
q=s.a
p=r.length
o=q.length
if(p>o)return!1
n=o-p
m=t.b
l=s.b
k=m.length
j=l.length
if(p+k<o+j)return!1
for(i=0;i<p;++i){h=r[i]
if(!A.x(a2,q[i],a6,h,a4))return!1}for(i=0;i<n;++i){h=m[i]
if(!A.x(a2,q[p+i],a6,h,a4))return!1}for(i=0;i<j;++i){h=m[n+i]
if(!A.x(a2,l[i],a6,h,a4))return!1}g=t.c
f=s.c
e=g.length
d=f.length
for(c=0,b=0;b<d;b+=3){a=f[b]
for(;;){if(c>=e)return!1
a0=g[c]
c+=3
if(a<a0)return!1
a1=g[c-2]
if(a0<a){if(a1)return!1
continue}h=f[b+1]
if(a1&&!h)return!1
h=g[c-1]
if(!A.x(a2,f[b+2],a6,h,a4))return!1
break}}while(c<e){if(g[c+1])return!1
c+=3}return!0},
hM(a,b,c,d,e){var t,s,r,q,p,o=b.x,n=d.x
while(o!==n){t=a.tR[o]
if(t==null)return!1
if(typeof t=="string"){o=t
continue}s=t[n]
if(s==null)return!1
r=s.length
q=r>0?new Array(r):v.typeUniverse.sEA
for(p=0;p<r;++p)q[p]=A.bP(a,b,s[p])
return A.fb(a,q,null,c,d.y,e)}return A.fb(a,b.y,null,c,d.y,e)},
fb(a,b,c,d,e,f){var t,s=b.length
for(t=0;t<s;++t)if(!A.x(a,b[t],d,e[t],f))return!1
return!0},
hR(a,b,c,d,e){var t,s=b.y,r=d.y,q=s.length
if(q!==r.length)return!1
if(b.x!==d.x)return!1
for(t=0;t<q;++t)if(!A.x(a,s[t],c,r[t],e))return!1
return!0},
b0(a){var t=a.w,s=!0
if(!(a===u.P||a===u.T))if(!A.aH(a))if(t!==6)s=t===7&&A.b0(a.x)
return s},
aH(a){var t=a.w
return t===2||t===3||t===4||t===5||a===u.X},
fa(a,b){var t,s,r=Object.keys(b),q=r.length
for(t=0;t<q;++t){s=r[t]
a[s]=b[s]}},
dK(a){return a>0?new Array(a):v.typeUniverse.sEA},
Z:function Z(a,b){var _=this
_.a=a
_.b=b
_.r=_.f=_.d=_.c=null
_.w=0
_.as=_.Q=_.z=_.y=_.x=null},
cw:function cw(){this.c=this.b=this.a=null},
dI:function dI(a){this.a=a},
cv:function cv(){},
aW:function aW(a){this.a=a},
f4(a,b,c){return 0},
aB:function aB(a,b){var _=this
_.a=a
_.e=_.d=_.c=_.b=null
_.$ti=b},
am:function am(a,b){this.a=a
this.$ti=b},
h3(a,b){return new A.a5(a.h("@<0>").D(b).h("a5<1,2>"))},
ec(a,b,c){return b.h("@<0>").D(c).h("eP<1,2>").a(A.ic(a,new A.a5(b.h("@<0>").D(c).h("a5<1,2>"))))},
E(a,b){return new A.a5(a.h("@<0>").D(b).h("a5<1,2>"))},
eQ(a){return new A.av(a.h("av<0>"))},
dc(a){return new A.av(a.h("av<0>"))},
eh(){var t=Object.create(null)
t["<non-identifier-key>"]=t
delete t["<non-identifier-key>"]
return t},
eZ(a,b,c){var t=new A.aw(a,b,c.h("aw<0>"))
t.c=a.e
return t},
h4(a,b,c){var t=A.h3(b,c)
a.M(0,new A.db(t,b,c))
return t},
dd(a,b){var t,s=A.eQ(b)
for(t=J.b2(a);t.n();)s.k(0,b.a(t.gp()))
return s},
de(a){var t,s
if(A.eu(a))return"{...}"
t=new A.aT("")
try{s={}
B.a.k($.R,a)
t.a+="{"
s.a=!0
a.M(0,new A.df(s,t))
t.a+="}"}finally{if(0>=$.R.length)return A.a($.R,-1)
$.R.pop()}s=t.a
return s.charCodeAt(0)==0?s:s},
av:function av(a){var _=this
_.a=0
_.f=_.e=_.d=_.c=_.b=null
_.r=0
_.$ti=a},
cz:function cz(a){this.a=a
this.c=this.b=null},
aw:function aw(a,b,c){var _=this
_.a=a
_.b=b
_.d=_.c=null
_.$ti=c},
db:function db(a,b,c){this.a=a
this.b=b
this.c=c},
u:function u(){},
Q:function Q(){},
df:function df(a,b){this.a=a
this.b=b},
bQ:function bQ(){},
aR:function aR(){},
bC:function bC(){},
ai:function ai(){},
bL:function bL(){},
aX:function aX(){},
hY(a,b){var t,s,r,q=null
try{q=JSON.parse(a)}catch(s){t=A.ex(s)
r=String(t)
throw A.b(new A.c7(r))}r=A.dM(q)
return r},
dM(a){var t
if(a==null)return null
if(typeof a!="object")return a
if(!Array.isArray(a))return new A.cx(a,Object.create(null))
for(t=0;t<a.length;++t)a[t]=A.dM(a[t])
return a},
eN(a,b,c){return new A.bk(a,b)},
hC(a){return a.c8()},
hc(a,b){return new A.dv(a,[],A.i8())},
hd(a,b,c){var t,s=new A.aT(""),r=A.hc(s,b)
r.a2(a)
t=s.a
return t.charCodeAt(0)==0?t:t},
cx:function cx(a,b){this.a=a
this.b=b
this.c=null},
cy:function cy(a){this.a=a},
c0:function c0(){},
c2:function c2(){},
bk:function bk(a,b){this.a=a
this.b=b},
cj:function cj(a,b){this.a=a
this.b=b},
d7:function d7(){},
d9:function d9(a){this.b=a},
d8:function d8(a){this.a=a},
dw:function dw(){},
dx:function dx(a,b){this.a=a
this.b=b},
dv:function dv(a,b,c){this.c=a
this.a=b
this.b=c},
a6(a,b,c,d){var t,s=c?J.eM(a,d):J.eL(a,d)
if(a!==0&&b!=null)for(t=0;t<s.length;++t)s[t]=b
return s},
bn(a,b,c){var t,s=A.d([],c.h("i<0>"))
for(t=J.b2(a);t.n();)B.a.k(s,c.a(t.gp()))
if(b)return s
s.$flags=1
return s},
ed(a,b){var t,s=A.d([],b.h("i<0>"))
for(t=a.gq(a);t.n();)B.a.k(s,t.gp())
return s},
z(a,b){var t=A.bn(a,!1,b)
t.$flags=3
return t},
eV(a,b,c){var t=J.b2(b)
if(!t.n())return a
if(c.length===0){do a+=A.j(t.gp())
while(t.n())}else{a+=A.j(t.gp())
while(t.n())a=a+c+A.j(t.gp())}return a},
fZ(a){return new A.c4(a)},
c5(a){if(typeof a=="number"||A.en(a)||a==null)return J.bV(a)
if(typeof a=="string")return JSON.stringify(a)
return A.eT(a)},
bY(a){return new A.bX(a)},
l(a){return new A.a2(!1,null,null,a)},
h8(a,b){return new A.bv(null,null,!0,a,b,"Value not in range")},
a8(a,b,c,d,e){return new A.bv(b,c,!0,a,d,"Invalid value")},
ee(a,b,c){if(0>a||a>c)throw A.b(A.a8(a,0,c,"start",null))
if(b!=null){if(a>b||b>c)throw A.b(A.a8(b,a,c,"end",null))
return b}return c},
dk(a,b){if(a<0)throw A.b(A.a8(a,0,null,b,null))
return a},
e7(a,b,c,d){return new A.be(b,!0,a,d,"Index out of range")},
cu(a){return new A.bD(a)},
eX(a){return new A.cs(a)},
aj(a){return new A.by(a)},
T(a){return new A.c1(a)},
h_(a,b,c){var t,s
if(A.eu(a)){if(b==="("&&c===")")return"(...)"
return b+"..."+c}t=A.d([],u.s)
B.a.k($.R,a)
try{A.hV(a,t)}finally{if(0>=$.R.length)return A.a($.R,-1)
$.R.pop()}s=A.eV(b,u.U.a(t),", ")+c
return s.charCodeAt(0)==0?s:s},
e9(a,b,c){var t,s
if(A.eu(a))return b+"..."+c
t=new A.aT(b)
B.a.k($.R,a)
try{s=t
s.a=A.eV(s.a,a,", ")}finally{if(0>=$.R.length)return A.a($.R,-1)
$.R.pop()}t.a+=c
s=t.a
return s.charCodeAt(0)==0?s:s},
hV(a,b){var t,s,r,q,p,o,n,m=a.gq(a),l=0,k=0
for(;;){if(!(l<80||k<3))break
if(!m.n())return
t=A.j(m.gp())
B.a.k(b,t)
l+=t.length+2;++k}if(!m.n()){if(k<=5)return
if(0>=b.length)return A.a(b,-1)
s=b.pop()
if(0>=b.length)return A.a(b,-1)
r=b.pop()}else{q=m.gp();++k
if(!m.n()){if(k<=4){B.a.k(b,A.j(q))
return}s=A.j(q)
if(0>=b.length)return A.a(b,-1)
r=b.pop()
l+=s.length+2}else{p=m.gp();++k
for(;m.n();q=p,p=o){o=m.gp();++k
if(k>100){for(;;){if(!(l>75&&k>3))break
if(0>=b.length)return A.a(b,-1)
l-=b.pop().length+2;--k}B.a.k(b,"...")
return}}r=A.j(q)
s=A.j(p)
l+=s.length+r.length+4}}if(k>b.length+2){l+=5
n="..."}else n=null
for(;;){if(!(l>80&&b.length>3))break
if(0>=b.length)return A.a(b,-1)
l-=b.pop().length+2
if(n==null){l+=5
n="..."}}if(n!=null)B.a.k(b,n)
B.a.k(b,r)
B.a.k(b,s)},
eR(a,b,c,d){var t
if(B.o===c){t=J.S(a)
b=J.S(b)
return A.eg(A.ak(A.ak($.e3(),t),b))}if(B.o===d){t=J.S(a)
b=J.S(b)
c=J.S(c)
return A.eg(A.ak(A.ak(A.ak($.e3(),t),b),c))}t=J.S(a)
b=J.S(b)
c=J.S(c)
d=J.S(d)
d=A.eg(A.ak(A.ak(A.ak(A.ak($.e3(),t),b),c),d))
return d},
c4:function c4(a){this.a=a},
dt:function dt(){},
p:function p(){},
bX:function bX(a){this.a=a},
bA:function bA(){},
a2:function a2(a,b,c,d){var _=this
_.a=a
_.b=b
_.c=c
_.d=d},
bv:function bv(a,b,c,d,e,f){var _=this
_.e=a
_.f=b
_.a=c
_.b=d
_.c=e
_.d=f},
be:function be(a,b,c,d,e){var _=this
_.f=a
_.a=b
_.b=c
_.c=d
_.d=e},
bD:function bD(a){this.a=a},
cs:function cs(a){this.a=a},
by:function by(a){this.a=a},
c1:function c1(a){this.a=a},
ck:function ck(){},
bx:function bx(){},
c7:function c7(a){this.a=a},
e:function e(){},
bt:function bt(){},
q:function q(){},
dn:function dn(){this.b=this.a=0},
aT:function aT(a){this.a=a},
e5(a){var t,s,r,q,p,o,n,m,l,k,j,i,h=A.eI(a),g=h.a,f=h.b,e=h.c
if(g===0){if(e===0)t=$.ad()
else t=new Float64Array(e)
return new A.v(0,t)}if(e===0)s=$.ad()
else s=new Float64Array(e)
for(t=a.length,r=s.length,q=s.$flags|0,p=0;p<t;++p){o=a[p]
n=o.a/g/f
for(m=o.b,l=m.length,k=0;k<e;++k){if(!(k<r))return A.a(s,k)
j=s[k]
if(!(k<l))return A.a(m,k)
i=m[k]
q&2&&A.m(s)
s[k]=j+n*i}}return new A.v(g*f,s)},
cM(a){var t,s,r,q,p,o,n,m,l,k,j,i,h,g,f=A.eI(a),e=f.a,d=f.b,c=f.c
if(e===0)throw A.b(A.aj("A zero vector has no direction."))
t=u.n
s=A.d([],t)
for(r=a.length,q=0;p=a.length,q<p;a.length===r||(0,A.h)(a),++q)s.push(a[q].a/e/d)
r=c===0
if(r)o=$.ad()
else o=new Float64Array(c)
for(n=o.length,m=s.length,l=o.$flags|0,k=0;k<p;++k)for(j=0;j<c;++j){if(!(j<n))return A.a(o,j)
i=o[j]
if(!(k<m))return A.a(s,k)
h=s[k]
g=a[k].b
if(!(j<g.length))return A.a(g,j)
g=g[j]
l&2&&A.m(o)
o[j]=i+h*g}p=A.d([],u.W)
for(k=0;k<a.length;++k){if(!(k<s.length))return A.a(s,k)
m=s[k]
if(r)l=$.ad()
else{l=A.d([],t)
for(j=0;j<c;++j){if(!(k<a.length))return A.a(a,k)
i=a[k].b
if(!(j<i.length))return A.a(i,j)
i=i[j]
if(!(k<s.length))return A.a(s,k)
h=s[k]
if(!(j<n))return A.a(o,j)
l.push((i-h*o[j])/d/e)}l=new Float64Array(A.F(l))}p.push(new A.v(m,l))}return p},
eI(a){var t,s,r,q,p,o,n,m
if(a.length===0)return B.a1
t=B.a.gaQ(a).b.length
for(s=a.length,r=0,q=0;q<s;++q){p=a[q]
if(p.b.length!==t)throw A.b(A.l("Dual components need one local dimension."))
o=p.a
if(!isFinite(o))throw A.b(A.aj("A geometric vector must have finite coordinates."))
r=Math.max(r,Math.abs(o))}if(r===0)return new A.az(0,0,t)
for(n=0,q=0;q<s;++q){m=a[q].a/r
n+=m*m}return new A.az(r,Math.sqrt(n),t)},
v:function v(a,b){this.a=a
this.b=b},
M(a){var t,s,r,q,p,o
for(t=a.length,s=0,r=1,q=0;q<t;++q){p=Math.abs(a[q])
if(!isFinite(p))return p
if(p===0)continue
if(s<p){o=s/p
r=1+r*o*o
s=p}else{o=p/s
r+=o*o}}return s===0?0:s*Math.sqrt(r)},
a1(a,b){var t,s,r,q,p
for(t=a.length,s=b.length,r=0,q=0;q<t;++q){p=a[q]
if(!(q<s))return A.a(b,q)
r+=p*b[q]}return r},
eo(a,b,c,d,e){var t,s,r,q,p,o,n,m=a.a,l=new Float64Array(m),k=a.b,j=new Float64Array(k),i=new Float64Array(k)
a.U(e,l)
for(t=b.length,s=0;s<m;++s){r=l[s]
if(!(s<t))return A.a(b,s)
q=b[s]
if(!(s<m))return A.a(l,s)
l[s]=r+q}a.P(l,j)
a.P(b,i)
for(m=c.length,t=e.length,p=0;p<k;++p){r=j[p]
if(!(p<m))return A.a(c,p)
q=c[p]
if(!(p<t))return A.a(e,p)
o=e[p]
if(!(p<k))return A.a(j,p)
j[p]=r+d*q*o}n=A.M(i)
return n===0?A.M(j):A.M(j)/n},
is(b9,c0,c1,c2,c3,c4,c5){var t,s,r,q,p,o,n,m,l,k,j,i,h,g,f,e,d,c,b,a,a0,a1,a2,a3,a4,a5,a6,a7,a8,a9,b0,b1,b2,b3,b4,b5,b6=b9.a,b7=b9.b,b8=c0.length
if(b8!==b7||c4<=0||!isFinite(c4))throw A.b(A.l("Invalid nullspace projection arguments."))
if(b6===0||b7===0)return new A.ar(B.d,new Float64Array(A.F(c0)))
t=b9.e
s=A.M(t)*A.M(c0)
if(!isFinite(s))return new A.ar(B.e,new Float64Array(b7))
r=new A.e_(b6,b9,s,c4)
q=c5.$0()
if(q==null?!1:q)return r.$3(new Float64Array(A.F(c0)),0,B.i)
if(b7<=c1&&b6*b7<=c2){b8=b7*b6
p=new Float64Array(b8)
for(q=b9.c,o=q.length,n=b9.d,m=n.length,l=t.length,k=0;k<b6;k=i){if(!(k<o))return A.a(q,k)
j=q[k]
i=k+1
if(!(i<o))return A.a(q,i)
for(;j<q[i];++j){if(!(j>=0&&j<m))return A.a(n,j)
h=n[j]*b6+k
if(!(h>=0&&h<b8))return A.a(p,h)
g=p[h]
if(!(j<l))return A.a(t,j)
f=t[j]
if(!(h<b8))return A.a(p,h)
p[h]=g+f}}e=A.el(p,b7,b6,null,c4,c5,c3)
b8=e.c
if(b8||e.e||!e.d){t=new Float64Array(A.F(c0))
if(b8)b8=B.i
else b8=e.e?B.h:B.e
return r.$3(t,e.a,b8)}d=new Float64Array(A.F(c0))
c=new A.e0(d,b7,p,b6)
for(b8=e.a,j=0;j<b8;++j)c.$1(j)
B.b.T(d,0,b8,0)
for(j=b8-1;j>=0;--j)c.$1(j)
return r.$4(d,b8,B.d,b8)}b=new Float64Array(b6)
b9.U(c0,b)
a=A.M(b)
if(a<=c4*s)return r.$3(new Float64Array(A.F(c0)),0,B.d)
a0=new Float64Array(b6)
a1=new Float64Array(A.F(b))
a2=new Float64Array(b6)
a3=new Float64Array(b6)
a4=new Float64Array(b6)
a5=new Float64Array(b7)
a6=new Float64Array(b6)
for(q=a1.length,o=b9.c,n=o.length,m=t.length,k=0;k<b6;k=i){if(!(k<n))return A.a(o,k)
j=o[k]
i=k+1
if(!(i<n))return A.a(o,i)
a7=0
for(;j<o[i];++j){if(!(j>=0&&j<m))return A.a(t,j)
l=t[j]
a7+=l*l}l=a7===0?1:a7
if(!(k<b6))return A.a(a6,k)
a6[k]=l
if(!(k<q))return A.a(a1,k)
l=a1[k]
h=a6[k]
if(!(k<b6))return A.a(a2,k)
a2[k]=l/h
h=a2[k]
if(!(k<b6))return A.a(a3,k)
a3[k]=h}a8=A.a1(a1,a2)
t=c4*a
b0=0
for(;;){if(!(b0<c3)){a9=B.h
break}o=c5.$0()
if(o==null?!1:o){a9=B.i
break}b9.P(a3,a5)
b9.U(a5,a4)
b1=A.a1(a3,a4)
if(!isFinite(b1)||b1<=0||!isFinite(a8)){a9=B.e
break}b2=a8/b1
for(o=a1.$flags|0,k=0;k<b6;++k){n=a0[k]
m=a3[k]
if(!(k<b6))return A.a(a0,k)
a0[k]=n+b2*m
if(!(k<q))return A.a(a1,k)
m=a1[k]
n=a4[k]
o&2&&A.m(a1)
a1[k]=m-b2*n}if(A.M(a1)<=t){++b0
a9=B.d
break}for(k=0;k<b6;++k){if(!(k<q))return A.a(a1,k)
o=a1[k]
n=a6[k]
if(!(k<b6))return A.a(a2,k)
a2[k]=o/n}b3=A.a1(a1,a2)
b4=b3/a8
for(k=0;k<b6;++k){o=a2[k]
n=a3[k]
if(!(k<b6))return A.a(a3,k)
a3[k]=o+b4*n}++b0
a8=b3}b9.P(a0,a5)
d=new Float64Array(b7)
for(b5=0;b5<b7;++b5){if(!(b5<b8))return A.a(c0,b5)
t=c0[b5]
q=a5[b5]
if(!(b5<b7))return A.a(d,b5)
d[b5]=t-q}return r.$3(d,b0,a9)},
fq(a,b,c,d,e){var t,s,r,q,p,o=null,n=A.el(new Float64Array(A.F(a)),b,c,o,d,e,o)
if(n.c||!n.d)return o
t=n.a
s=n.b
r=u.S
q=A.G(s).h("u.E")
p=A.z(A.dp(s,0,A.eq(t,"count",r),q),r)
A.z(A.dp(s,t,o,q),r)
return new A.d_(t,p)},
el(c0,c1,c2,c3,c4,c5,c6){var t,s,r,q,p,o,n,m,l,k,j,i,h,g,f,e,d,c,b,a,a0,a1,a2,a3,a4,a5,a6,a7,a8,a9,b0,b1,b2,b3,b4,b5,b6,b7,b8={},b9=J.cg(c2,u.S)
for(t=0;t<c2;++t)b9[t]=t
s=new Int32Array(A.F(b9))
r=new Float64Array(c2)
q=new Float64Array(c2)
b8.a=b8.b=b8.c=b8.d=0
p=new A.dQ(b8,s)
o=new A.dP(b8,c1,c0,c2)
n=c5.$0()
if(n==null?!1:n)return p.$1$cancelled(!0)
n=c6!=null
if(n&&c6<=0&&c1>0&&c2>0)return p.$1$iterationLimit(!0)
for(m=0;m<c2;++m){l=c5.$0()
if(l==null?!1:l)return p.$1$cancelled(!0)
k=o.$2(0,m)
if(!isFinite(k))return p.$1$finite(!1)
if(!(m<c2))return A.a(q,m)
q[m]=k
if(!(m<c2))return A.a(r,m)
r[m]=k}for(l=Math.min(c1,c2),j=c0.length,i=s.length,h=s.$flags|0,g=c0.$flags|0,f=0,e=0;e<l;e=a0){d=c5.$0()
if(d==null?!1:d)return p.$1$cancelled(!0)
if(n&&e>=c6)return p.$1$iterationLimit(!0)
for(m=e,c=m,b=-1;m<c2;++m){k=r[m]
if(k>b){b=k
c=m}}d=e===0
a=!d
if(a)b=o.$2(e,c)
if(!isFinite(b))return p.$1$finite(!1)
if(d)f=b*c4
if(a)d=b<=f||b===0
else d=!1
if(d)for(m=e;m<c2;++m){d=c5.$0()
if(d==null?!1:d)return p.$1$cancelled(!0)
k=o.$2(e,m)
if(!isFinite(k))return p.$1$finite(!1)
if(!(m<c2))return A.a(q,m)
q[m]=k
if(!(m<c2))return A.a(r,m)
r[m]=k
if(k>b){b=k
c=m}}if(b<=f||b===0)break
if(c!==e){for(a0=0;a0<c1;++a0){a1=a0*c2
d=a1+e
if(!(d<j))return A.a(c0,d)
a2=c0[d]
a=a1+c
if(!(a>=0&&a<j))return A.a(c0,a)
a3=c0[a]
g&2&&A.m(c0)
c0[d]=a3
c0[a]=a2}if(!(e<i))return A.a(s,e)
a1=s[e]
if(!(c>=0&&c<i))return A.a(s,c)
d=s[c]
h&2&&A.m(s)
s[e]=d
s[c]=a1
if(!(e<c2))return A.a(r,e)
k=r[e]
if(!(e<c2))return A.a(q,e)
a4=q[e]
if(!(c<c2))return A.a(r,c)
r[e]=r[c]
if(!(c<c2))return A.a(q,c)
q[e]=q[c]
r[c]=k
q[c]=a4}d=e*c2
a=d+e
if(!(a<j))return A.a(c0,a)
a5=c0[a]
a6=a5>=0?-b:b
a7=a5-a6
a8=(a6-a5)/a6
c0.$flags&2&&A.m(c0)
c0[a]=a6
for(a0=e+1,a9=a0;a9<c1;++a9){a=a9*c2+e
if(!(a<j))return A.a(c0,a)
c0[a]=c0[a]/a7}for(m=a0;m<c2;++m){a=d+m
if(!(a<j))return A.a(c0,a)
b0=c0[a]
for(a9=a0,b1=b0;a9<c1;++a9){a3=a9*c2
b2=a3+e
if(!(b2<j))return A.a(c0,b2)
b2=c0[b2]
a3+=m
if(!(a3<j))return A.a(c0,a3)
b1+=b2*c0[a3]}b1*=a8
c0.$flags&2&&A.m(c0)
c0[a]=b0-b1
for(a9=a0;a9<c1;++a9){a3=a9*c2
b2=a3+m
if(!(b2<j))return A.a(c0,b2)
b3=c0[b2]
a3+=e
if(!(a3<j))return A.a(c0,a3)
c0[b2]=b3-c0[a3]*b1}b4=r[m]
if(b4!==0){b5=Math.abs(c0[a])/b4
b6=Math.max(0,(1-b5)*(1+b5))
b7=b4/q[m]
if(!isFinite(b6)||b6*b7*b7<=14901161193847656e-24){k=o.$2(a0,m)
if(!isFinite(k))return p.$1$finite(!1)
if(!(m<c2))return A.a(q,m)
q[m]=k
if(!(m<c2))return A.a(r,m)
r[m]=k}else{a=Math.sqrt(b6)
if(!(m<c2))return A.a(r,m)
r[m]=b4*a;++b8.b}}}if(c3!=null){d=c3.length
if(!(e<d))return A.a(c3,e)
b0=c3[e]
for(a9=a0,b1=b0;a9<c1;++a9){a=a9*c2+e
if(!(a<j))return A.a(c0,a)
a=c0[a]
if(!(a9<d))return A.a(c3,a9)
b1+=a*c3[a9]}b1*=a8
c3.$flags&2&&A.m(c3)
c3[e]=b0-b1
for(a9=a0;a9<c1;++a9){if(!(a9<d))return A.a(c3,a9)
a=c3[a9]
a3=a9*c2+e
if(!(a3<j))return A.a(c0,a3)
c3[a9]=a-c0[a3]*b1}}++b8.a}return p.$0()},
dm:function dm(a,b,c,d,e){var _=this
_.a=a
_.b=b
_.c=c
_.d=d
_.e=e},
ae:function ae(a,b){this.a=a
this.b=b},
K:function K(a,b,c){this.a=a
this.b=b
this.c=c},
c3:function c3(){},
cp:function cp(){},
bW:function bW(){},
d_:function d_(a,b){this.a=a
this.b=b},
ar:function ar(a,b){this.a=a
this.b=b},
e_:function e_(a,b,c,d){var _=this
_.a=a
_.b=b
_.c=c
_.d=d},
e0:function e0(a,b,c,d){var _=this
_.a=a
_.b=b
_.c=c
_.d=d},
bK:function bK(a,b,c,d,e,f,g,h){var _=this
_.a=a
_.b=b
_.c=c
_.d=d
_.e=e
_.f=f
_.r=g
_.w=h},
dQ:function dQ(a,b){this.a=a
this.b=b},
dP:function dP(a,b,c,d){var _=this
_.a=a
_.b=b
_.c=c
_.d=d},
aE(a,b){var t,s,r=A.d([],u.W)
for(t=0;t<3;++t){if(!(t<a.length))return A.a(a,t)
s=a[t]
if(!(t<b.length))return A.a(b,t)
r.push(s.V(0,b[t]))}return r},
at:function at(a,b,c){this.a=a
this.b=b
this.c=c},
bc:function bc(a){this.a=a},
d2:function d2(a){this.a=a},
b9:function b9(a,b){this.a=a
this.b=b},
bb:function bb(a,b){this.a=a
this.b=b},
cN:function cN(a,b){this.c=a
this.d=b},
cP:function cP(){},
cQ:function cQ(){},
cT:function cT(a){this.a=a},
cR:function cR(){},
cS:function cS(){},
cO:function cO(a,b){this.a=a
this.b=b},
e6(a,b,c,d,e){var t=u.i,s=A.z(e,t),r=e.length,q=A.z(c==null?A.a6(r,-1/0,!1,t):c,t),p=A.z(d==null?A.a6(e.length,1/0,!1,t):d,t),o=e.length
o=A.a6(o,1,!1,t)
r=new A.ca(b,s,a,q,p,A.z(o,t),new A.c6(r))
r.b6(a,b,c,null,null,d,e)
return r},
hb(a,b,c,d,e,f,g,h){var t,s=new A.ds(b,d,a),r=A.z(c,u.N),q=u.i,p=A.a6(d,g,!1,q)
p=A.z(p,q)
t=A.a6(d,e,!1,q)
r=new A.aU(a,b,r,d,s,p,A.z(t,q))
r.b8(s,b,c,d,e,f,g,h)
return r},
fh(a,a0,a1,a2,a3,a4,a5,a6){var t,s,r,q,p,o,n,m,l,k,j,i,h,g,f,e,d,c,b=a4==null
if(b)t=0
else t=a5==null?B.a.aR(a2,0,new A.dO(),u.S):a5
s=A.d([],u.h)
for(b=!b,r=u.S,q=t===0,p=u.W,o=a6==null,n=0,m=0;m<a2.length;++m){if(o)l=null
else{if(!(m<a6.length))return A.a(a6,m)
k=a6[m]
l=k}if(l==null)l=n
k=A.d([],p)
j=l<0
i=0
for(;;){if(!(m<a2.length))return A.a(a2,m)
h=a2[m]
if(!(i<h.length))break
if(!b||j){h=h[i]
if(q)g=$.ad()
else g=new Float64Array(t)
k.push(new A.v(h,g))}else{h=h[i]
g=l+i
if(g<0||g>=t){A.a6(t,0,!1,r)
A.V(new A.be(t,!0,g,null,"Index out of range"))}f=new Float64Array(t)
if(!(g>=0&&g<t))return A.a(f,g)
f[g]=1
k.push(new A.v(h,f))}++i}B.a.k(s,k)
if(!(m<a2.length))return A.a(a2,m)
n+=a2[m].length}e=a1.$1(s)
b=e.length
if(b!==a0)throw A.b(A.aj("Residual "+a+" returned "+b+" components; expected "+a0+"."))
for(r=a2.length,q=a3.$flags|0,d=0;d<a0;++d){if(!(d<b))return A.a(e,d)
p=e[d]
q&2&&A.m(a3)
if(!(d<a3.length))return A.a(a3,d)
a3[d]=p.a
if(a4==null)continue
if(e[d].b.length!==t)throw A.b(A.aj("Residual "+a+" returned a mismatched Dual dimension."))
for(p=a4.length,n=0,m=0;m<r;++m){if(o)l=null
else{if(!(m<a6.length))return A.a(a6,m)
k=a6[m]
l=k}if(l==null)l=n
k=a2[m]
n+=k.length
if(l<0)continue
for(i=0;j=k.length,i<j;++i){if(!(m<p))return A.a(a4,m)
h=a4[m]
j=d*j+i
g=e[d].b
c=l+i
if(!(c<g.length))return A.a(g,c)
c=g[c]
h.$flags&2&&A.m(h)
if(!(j<h.length))return A.a(h,j)
h[j]=c}}}},
fY(a){var t=u.N,s=u.S
s=new A.cD(a.a,a.b,A.E(t,s),A.E(t,s),A.E(s,u.bz),A.E(s,s),A.d([],u.e))
s.b5(a)
return s},
eK(a,b,c,d){var t=u.i,s=A.z(c,t)
t=new A.ba(b,s,d,A.z(a==null?A.a6(c.length,1,!1,t):a,t))
t.b7(a,b,c,d)
return t},
i1(a,b){var t,s,r,q,p,o,n=u.z
n=A.E(n,n)
for(t=a.a,s=t.length,r=u.i,q=0;q<s;++q){p=t[q]
if(!(q<b.length))return A.a(b,q)
o=A.bn(b[q],!1,r)
o.$flags=3
n.l(0,p.a,o)}return A.eG(n,u.N,u.o)},
dN(a){var t,s,r=A.d([],u.w)
for(t=a.length,s=0;s<a.length;a.length===t||(0,A.h)(a),++s)r.push(new Float64Array(A.F(a[s])))
return r},
i_(a,b){var t,s,r=a.length,q=b.length
if(r!==q)return!1
for(t=0;t<r;++t){s=a[t]
if(!(t<q))return A.a(b,t)
if(s!==b[t])return!1}return!0},
hX(a,b,c){},
c9:function c9(){},
cU:function cU(){},
c6:function c6(a){this.a=a},
ca:function ca(a,b,c,d,e,f,g){var _=this
_.a=a
_.b=b
_.c=c
_.d=d
_.e=e
_.f=f
_.r=g},
cW:function cW(){},
bd:function bd(a,b,c,d,e,f){var _=this
_.a=a
_.b=b
_.c=c
_.d=d
_.e=e
_.f=f},
d0:function d0(){},
d1:function d1(){},
aU:function aU(a,b,c,d,e,f,g){var _=this
_.r=a
_.a=b
_.b=c
_.c=d
_.d=e
_.e=f
_.f=g},
ds:function ds(a,b,c){this.a=a
this.b=b
this.c=c},
dO:function dO(){},
cV:function cV(a,b){this.a=a
this.b=b},
cD:function cD(a,b,c,d,e,f,g){var _=this
_.a=a
_.b=b
_.c=c
_.d=d
_.e=e
_.f=f
_.r=g},
cK:function cK(a){this.a=a},
cE:function cE(a){this.a=a},
cF:function cF(){},
cG:function cG(a){this.a=a},
cH:function cH(){},
cI:function cI(){},
cJ:function cJ(){},
cL:function cL(){},
af:function af(a,b){this.a=a
this.b=b},
cc:function cc(a,b,c,d,e,f,g,h,i){var _=this
_.a=a
_.b=b
_.c=c
_.d=d
_.e=e
_.f=f
_.r=g
_.w=h
_.x=i},
ba:function ba(a,b,c,d){var _=this
_.a=a
_.b=b
_.c=c
_.d=d},
cX:function cX(){},
cY:function cY(){},
cb:function cb(a,b,c,d,e,f,g,h){var _=this
_.a=a
_.b=b
_.c=c
_.d=d
_.e=e
_.f=f
_.r=g
_.w=h},
a_:function a_(a,b){this.a=a
this.b=b},
cZ:function cZ(){},
aq:function aq(a,b,c){this.a=a
this.d=b
this.f=c},
d3:function d3(a,b,c){this.a=a
this.c=b
this.e=c},
d4:function d4(a,b,c){var _=this
_.a=a
_.b=$
_.c=null
_.d=$
_.e=b
_.f=c
_.r=null
_.w=0
_.x=!1},
aA:function aA(a,b,c,d,e,f){var _=this
_.a=a
_.b=b
_.c=c
_.d=d
_.e=e
_.f=f},
au:function au(a,b,c,d){var _=this
_.a=a
_.b=b
_.c=c
_.d=d
_.f=_.e=0
_.w=_.r=$},
bR:function bR(a,b,c,d){var _=this
_.a=a
_.b=b
_.c=c
_.d=d
_.e=$
_.f=null
_.r=!1},
dL:function dL(a,b,c,d,e,f,g,h,i,j,k,l,m){var _=this
_.a=a
_.b=b
_.c=c
_.d=d
_.e=e
_.f=f
_.r=g
_.w=h
_.x=i
_.y=j
_.z=k
_.Q=l
_.as=m},
dz:function dz(a,b,c,d,e,f){var _=this
_.a=a
_.b=b
_.c=c
_.d=d
_.e=e
_.f=f},
al:function al(a,b,c){this.a=a
this.b=b
this.c=c},
dy:function dy(a,b,c,d){var _=this
_.a=a
_.b=b
_.c=c
_.d=d},
cA:function cA(a,b,c,d,e,f,g,h,i,j,k,l,m){var _=this
_.a=a
_.b=b
_.c=c
_.d=d
_.e=e
_.f=f
_.r=g
_.w=h
_.x=i
_.y=j
_.z=k
_.Q=l
_.as=m
_.cy=_.cx=_.CW=_.ch=_.ay=_.ax=_.at=null
_.ok=_.k4=_.k3=_.k2=_.k1=_.id=_.go=_.fy=_.fx=_.fr=_.dy=_.dx=_.db=0},
dD:function dD(a){this.a=a},
dE:function dE(){},
dG:function dG(a,b,c,d,e,f){var _=this
_.a=a
_.b=b
_.c=c
_.d=d
_.e=e
_.f=f},
dF:function dF(a){this.a=a},
dH:function dH(){},
dB:function dB(a){this.a=a},
dC:function dC(a){this.a=a},
iu(b8){var t,s,r,q,p,o,n,m,l,k,j,i,h,g,f,e,d,c,b,a,a0,a1,a2,a3,a4,a5,a6,a7,a8,a9,b0,b1,b2,b3,b4,b5=null,b6="Duplicate geometric parameter ",b7="other"
try{t=u.cg.a(B.n.bD(b8,b5))
a3=u.j
s=a3.a(J.t(t,"points"))
r=a3.a(J.t(t,"constraints"))
q=u.cO.a(J.t(t,"target"))
if(J.D(s)<3||J.D(s)>32||J.fM(r)||J.D(r)>48)throw A.b(B.q)
a4=u.N
a5=u._
a6=u.x
a7=!0
if(isFinite(1e-7))a7=!isFinite(1e-9)
if(a7)A.V(A.l("Geometry tolerances must be finite and positive."))
p=new A.cN(A.E(a4,a5),A.E(a4,a6))
o=p.bY("origin",B.a7,!0)
n=new A.bb(o,B.a8.av())
m=A.d([],u.k)
l=0
a7=u.n
a8=isFinite(0)
for(;;){a9=l
b0=J.D(s)
if(typeof a9!=="number")return a9.K()
if(!(a9<b0))break
a9="p"+A.j(l)
b0=A.bS(J.t(J.t(s,l),0))
b1=A.bS(J.t(J.t(s,l),1))
b2=J.aJ(l,0)
if(!(isFinite(b0)&&isFinite(b1)&&a8))A.V(A.l("A point must be finite."))
b0=A.e6(b2,a9,b5,b5,A.d([b0,b1,0],a7))
b1=p.c
b2=b0.a
if(b1.C(b2))A.V(A.l(b6+b2+"."))
b1.l(0,b2,b0)
J.bU(m,new A.bc(a9))
a9=l
if(typeof a9!=="number")return a9.A()
l=a9+1}k=m
j=1
for(;;){m=j
a8=J.D(k)
if(typeof m!=="number")return m.K()
if(!(m<a8))break
p.aw("xy"+A.j(j),J.t(k,j),n)
m=j
if(typeof m!=="number")return m.A()
j=m+1}i=new A.e1(k)
h=0
for(;;){m=h
a8=J.D(r)
if(typeof m!=="number")return m.K()
if(!(m<a8))break
g=J.t(r,h)
f="constraint"+A.j(h)
e=i.$1(A.y(J.t(g,"edge")))
switch(J.t(g,"kind")){case"horizontal":p.aw(f,e.b,new A.bb(e.a,B.a9.av()))
break
case"vertical":p.aw(f,e.b,new A.bb(e.a,B.aa.av()))
break
case"length":d=A.bS(J.t(g,"length"))
m=e.a
a8=e.b
a9="length"+A.j(h)
b0=A.d([A.aC(d)],a7)
b1=A.d([0.01],a7)
b0=A.e6(!0,a9,b1,b5,b0)
b1=p.c
b2=b0.a
if(b1.C(b2))A.V(A.l(b6+b2+"."))
b1.l(0,b2,b0)
p.bF(f,m,a8,new A.d2(a9))
break
case"parallel":p.bV(f,e,i.$1(A.y(J.t(g,b7))))
break
case"perpendicular":p.bW(f,e,i.$1(A.y(J.t(g,b7))))
break
case"equal":p.bI(f,e,i.$1(A.y(J.t(g,b7))))
break
default:throw A.b(B.q)}m=h
if(typeof m!=="number")return m.A()
h=m+1}c=A.d([],u.u)
if(q!=null){b=A.y(q.j(0,"index"))
a=a3.a(q.j(0,"point"))
m=b
if(typeof m!=="number")return m.K()
if(!(m<1)){m=b
a3=J.D(k)
if(typeof m!=="number")return m.c7()
m=m>=a3||J.D(a)!==2}else m=!0
if(m)throw A.b(B.q)
J.bU(c,A.eK(b5,J.t(k,b).a,A.d([A.bS(J.t(a,0)),A.bS(J.t(a,1)),0],a7),1))}m=p
a3=m.c
m=m.d
a6=A.fY(new A.cV(A.z(new A.X(a3,A.r(a3).h("X<2>")),a5),A.z(new A.X(m,A.r(m).h("X<2>")),a6)))
m=u.S
m=new A.d4(a6,A.dc(m),A.E(m,u.M))
m.b9(a6,b5)
a0=m.b1(c)
if(a0.a!==B.k){m=B.n.ao(A.ec(["status","unsolved"],a4,a4),b5)
return m}m=a0.gbT()
a1=A.d([],u.B)
for(a3=k,a5=a3.length,b3=0;b3<a3.length;a3.length===a5||(0,A.h)(a3),++b3){a2=a3[b3]
a6=a0.c.j(0,a2.a)
a6.toString
J.bU(a1,J.fQ(a6,2).c1(0))}m=B.n.ao(A.ec(["status","solved","degrees",m,"points",a1],a4,u.X),b5)
return m}catch(b4){m=u.N
m=B.n.ao(A.ec(["status","unsolved"],m,m),b5)
return m}},
ip(){var t,s=new A.dY()
if(typeof s=="function")A.V(A.l("Attempting to rewrap a JS function."))
t=function(a,b){return function(c){return a(b,c,arguments.length)}}(A.hA,s)
t[$.ey()]=s
v.G.solveBrickwrightOutline=t},
e1:function e1(a){this.a=a},
dY:function dY(){},
iv(a){throw A.w(A.eO(a),new Error())},
b1(){throw A.w(A.h2(""),new Error())},
ew(){throw A.w(A.h1(""),new Error())},
iw(){throw A.w(A.eO(""),new Error())},
hA(a,b,c){u.Z.a(a)
if(A.y(c)>=1)return a.$1(b)
return a.$0()},
fu(a,b,c){A.i7(c,u.H,"T","max")
return Math.max(c.a(a),c.a(b))}},B={}
var w=[A,J,B]
var $={}
A.ea.prototype={}
J.ce.prototype={
N(a,b){return a===b},
gu(a){return A.cm(a)},
i(a){return"Instance of '"+A.cn(a)+"'"},
gJ(a){return A.ab(A.em(this))}}
J.bf.prototype={
i(a){return String(a)},
a3(a,b){A.fc(b)
return b&&a},
gu(a){return a?519018:218159},
gJ(a){return A.ab(u.y)},
$iI:1,
$io:1}
J.bh.prototype={
N(a,b){return null==b},
i(a){return"null"},
gu(a){return 0},
$iI:1}
J.bj.prototype={$iN:1}
J.ag.prototype={
gu(a){return 0},
i(a){return String(a)}}
J.cl.prototype={}
J.bB.prototype={}
J.a4.prototype={
i(a){var t=a[$.fz()]
if(t==null)t=a[$.ey()]
if(t==null)return this.b3(a)
return"JavaScript function for "+J.bV(t)},
$ia3:1}
J.aN.prototype={
gu(a){return 0},
i(a){return String(a)}}
J.aP.prototype={
gu(a){return 0},
i(a){return String(a)}}
J.i.prototype={
k(a,b){A.C(a).c.a(b)
a.$flags&1&&A.m(a,29)
a.push(b)},
L(a,b){A.C(a).h("e<1>").a(b)
a.$flags&1&&A.m(a,"addAll",2)
this.bd(a,b)
return},
bd(a,b){var t,s
u.b.a(b)
t=b.length
if(t===0)return
if(a===b)throw A.b(A.T(a))
for(s=0;s<t;++s)a.push(b[s])},
aU(a,b,c){var t=A.C(a)
return new A.a7(a,t.D(c).h("1(2)").a(b),t.h("@<1>").D(c).h("a7<1,2>"))},
bS(a,b){var t,s=A.a6(a.length,"",!1,u.N)
for(t=0;t<a.length;++t)this.l(s,t,A.j(a[t]))
return s.join(b)},
aY(a,b){return A.dp(a,0,A.eq(b,"count",u.S),A.C(a).c)},
aR(a,b,c,d){var t,s,r
d.a(b)
A.C(a).D(d).h("1(1,2)").a(c)
t=a.length
for(s=b,r=0;r<t;++r){s=c.$2(s,a[r])
if(a.length!==t)throw A.b(A.T(a))}return s},
H(a,b){if(!(b>=0&&b<a.length))return A.a(a,b)
return a[b]},
gaQ(a){if(a.length>0)return a[0]
throw A.b(A.d5())},
O(a,b){var t,s
A.C(a).h("o(1)").a(b)
t=a.length
for(s=0;s<t;++s){if(b.$1(a[s]))return!0
if(a.length!==t)throw A.b(A.T(a))}return!1},
bM(a,b){var t,s=a.length
if(0>=s)return-1
for(t=0;t<s;++t){if(!(t<a.length))return A.a(a,t)
if(J.aJ(a[t],b))return t}return-1},
gF(a){return a.length===0},
gaT(a){return a.length!==0},
i(a){return A.e9(a,"[","]")},
gq(a){return new J.ap(a,a.length,A.C(a).h("ap<1>"))},
gu(a){return A.cm(a)},
gm(a){return a.length},
j(a,b){A.y(b)
if(!(b>=0&&b<a.length))throw A.b(A.cB(a,b))
return a[b]},
l(a,b,c){A.C(a).c.a(c)
a.$flags&2&&A.m(a)
if(!(b>=0&&b<a.length))throw A.b(A.cB(a,b))
a[b]=c},
bN(a,b){var t
A.C(a).h("o(1)").a(b)
if(0>=a.length)return-1
for(t=0;t<a.length;++t)if(b.$1(a[t]))return t
return-1},
$ie:1,
$if:1}
J.cf.prototype={
c3(a){var t,s,r
if(!Array.isArray(a))return null
t=a.$flags|0
if((t&4)!==0)s="const, "
else if((t&2)!==0)s="unmodifiable, "
else s=(t&1)!==0?"fixed, ":""
r="Instance of '"+A.cn(a)+"'"
if(s==="")return r
return r+" ("+s+"length: "+a.length+")"}}
J.d6.prototype={}
J.ap.prototype={
gp(){var t=this.d
return t==null?this.$ti.c.a(t):t},
n(){var t,s=this,r=s.a,q=r.length
if(s.b!==q){r=A.h(r)
throw A.b(r)}t=s.c
if(t>=q){s.d=null
return!1}s.d=r[t]
s.c=t+1
return!0},
$iL:1}
J.bi.prototype={
am(a,b){var t
if(a<b)return-1
else if(a>b)return 1
else if(a===b){if(a===0){t=this.gau(b)
if(this.gau(a)===t)return 0
if(this.gau(a))return-1
return 1}return 0}else if(isNaN(a)){if(isNaN(b))return 0
return 1}else return-1},
gau(a){return a===0?1/a<0:a<0},
bL(a){var t,s
if(a>=0){if(a<=2147483647)return a|0}else if(a>=-2147483648){t=a|0
return a===t?t:t-1}s=Math.floor(a)
if(isFinite(s))return s
throw A.b(A.cu(""+a+".floor()"))},
al(a,b,c){if(this.am(b,c)>0)throw A.b(A.fp(b))
if(this.am(a,b)<0)return b
if(this.am(a,c)>0)return c
return a},
i(a){if(a===0&&1/a<0)return"-0.0"
else return""+a},
gu(a){var t,s,r,q,p=a|0
if(a===p)return p&536870911
t=Math.abs(a)
s=Math.log(t)/0.6931471805599453|0
r=Math.pow(2,s)
q=t<1?t/r:r/t
return((q*9007199254740992|0)+(q*3542243181176521|0))*599197+s*1259&536870911},
b0(a,b){var t=a%b
if(t===0)return 0
if(t>0)return t
return t+b},
aj(a,b){return(a|0)===a?a/b|0:this.bA(a,b)},
bA(a,b){var t=a/b
if(t>=-2147483648&&t<=2147483647)return t|0
if(t>0){if(t!==1/0)return Math.floor(t)}else if(t>-1/0)return Math.ceil(t)
throw A.b(A.cu("Result of truncating division is "+A.j(t)+": "+A.j(a)+" ~/ "+b))},
aN(a,b){var t
if(a>0)t=this.bw(a,b)
else{t=b>31?31:b
t=a>>t>>>0}return t},
bw(a,b){return b>31?0:a>>>b},
gJ(a){return A.ab(u.H)},
$ik:1,
$iac:1}
J.bg.prototype={
gJ(a){return A.ab(u.S)},
$iI:1,
$ic:1}
J.ch.prototype={
gJ(a){return A.ab(u.i)},
$iI:1}
J.aM.prototype={
Z(a,b,c){return a.substring(b,A.ee(b,c,a.length))},
t(a,b){var t,s
if(0>=b)return""
if(b===1||a.length===0)return a
if(b!==b>>>0)throw A.b(B.J)
for(t=a,s="";;){if((b&1)===1)s=t+s
b=b>>>1
if(b===0)break
t+=t}return s},
bU(a,b,c){var t=b-a.length
if(t<=0)return a
return this.t(c,t)+a},
i(a){return a},
gu(a){var t,s,r
for(t=a.length,s=0,r=0;r<t;++r){s=s+a.charCodeAt(r)&536870911
s=s+((s&524287)<<10)&536870911
s^=s>>6}s=s+((s&67108863)<<3)&536870911
s^=s>>11
return s+((s&16383)<<15)&536870911},
gJ(a){return A.ab(u.N)},
gm(a){return a.length},
j(a,b){A.y(b)
if(b>=a.length)throw A.b(A.cB(a,b))
return a[b]},
$iI:1,
$in:1}
A.aQ.prototype={
i(a){return"LateInitializationError: "+this.a}}
A.dl.prototype={}
A.b8.prototype={}
A.Y.prototype={
gq(a){var t=this
return new A.as(t,t.gm(t),A.r(t).h("as<Y.E>"))},
gF(a){return this.gm(this)===0}}
A.bz.prototype={
gbj(){var t=J.D(this.a),s=this.c
if(s==null||s>t)return t
return s},
gby(){var t=J.D(this.a),s=this.b
if(s>t)return t
return s},
gm(a){var t,s=J.D(this.a),r=this.b
if(r>=s)return 0
t=this.c
if(t==null||t>=s)return s-r
return t-r},
H(a,b){var t=this,s=t.gby()+b
if(b<0||s>=t.gbj())throw A.b(A.e7(b,t.gm(0),t,"index"))
return J.eA(t.a,s)},
c2(a,b){var t,s,r,q=this,p=q.b,o=q.a,n=J.cC(o),m=n.gm(o),l=q.c
if(l!=null&&l<m)m=l
t=m-p
if(t<=0){o=q.$ti.c
return b?J.eM(0,o):J.eL(0,o)}s=A.a6(t,n.H(o,p),b,q.$ti.c)
for(r=1;r<t;++r){B.a.l(s,r,n.H(o,p+r))
if(n.gm(o)<m)throw A.b(A.T(q))}return s},
c1(a){return this.c2(0,!0)}}
A.as.prototype={
gp(){var t=this.d
return t==null?this.$ti.c.a(t):t},
n(){var t,s=this,r=s.a,q=J.cC(r),p=q.gm(r)
if(s.b!==p)throw A.b(A.T(r))
t=s.c
if(t>=p){s.d=null
return!1}s.d=q.H(r,t);++s.c
return!0},
$iL:1}
A.a7.prototype={
gm(a){return J.D(this.a)},
H(a,b){return this.b.$1(J.eA(this.a,b))}}
A.aa.prototype={
gq(a){return new A.bE(J.b2(this.a),this.b,this.$ti.h("bE<1>"))}}
A.bE.prototype={
n(){var t,s
for(t=this.a,s=this.b;t.n();)if(s.$1(t.gp()))return!0
return!1},
gp(){return this.a.gp()},
$iL:1}
A.W.prototype={
sm(a,b){throw A.b(A.cu("Cannot change the length of a fixed-length list"))},
k(a,b){A.G(a).h("W.E").a(b)
throw A.b(A.cu("Cannot add to a fixed-length list"))}}
A.az.prototype={$r:"+(1,2,3)",$s:1}
A.b4.prototype={}
A.b3.prototype={
gF(a){return this.b.length===0},
i(a){return A.de(this)},
$iP:1}
A.b6.prototype={
gm(a){return this.b.length},
gbm(){var t=this.$keys
if(t==null){t=Object.keys(this.a)
this.$keys=t}return t},
C(a){if(typeof a!="string")return!1
if("__proto__"===a)return!1
return this.a.hasOwnProperty(a)},
j(a,b){if(!this.C(b))return null
return this.b[this.a[b]]},
M(a,b){var t,s,r,q
this.$ti.h("~(1,2)").a(b)
t=this.gbm()
s=this.b
for(r=t.length,q=0;q<r;++q)b.$2(t[q],s[q])}}
A.bF.prototype={
gp(){var t=this.d
return t==null?this.$ti.c.a(t):t},
n(){var t=this,s=t.c
if(s>=t.b){t.d=null
return!1}t.d=t.a[s]
t.c=s+1
return!0},
$iL:1}
A.b5.prototype={
k(a,b){A.r(this).c.a(b)
A.eH()},
aX(a,b){A.eH()}}
A.b7.prototype={
gm(a){return this.b},
gq(a){var t,s=this,r=s.$keys
if(r==null){r=Object.keys(s.a)
s.$keys=r}t=r
return new A.bF(t,t.length,s.$ti.h("bF<1>"))}}
A.cd.prototype={
N(a,b){if(b==null)return!1
return b instanceof A.aL&&this.a.N(0,b.a)&&A.es(this)===A.es(b)},
gu(a){return A.eR(this.a,A.es(this),B.o,B.o)},
i(a){var t=B.a.bS([A.ab(this.$ti.c)],", ")
return this.a.i(0)+" with "+("<"+t+">")}}
A.aL.prototype={
$2(a,b){return this.a.$1$2(a,b,this.$ti.y[0])},
$S(){return A.il(A.dR(this.a),this.$ti)}}
A.dh.prototype={
$0(){return B.l.bL(1000*this.a.now())},
$S:2}
A.bw.prototype={}
A.dq.prototype={
I(a){var t,s,r=this,q=new RegExp(r.a).exec(a)
if(q==null)return null
t=Object.create(null)
s=r.b
if(s!==-1)t.arguments=q[s+1]
s=r.c
if(s!==-1)t.argumentsExpr=q[s+1]
s=r.d
if(s!==-1)t.expr=q[s+1]
s=r.e
if(s!==-1)t.method=q[s+1]
s=r.f
if(s!==-1)t.receiver=q[s+1]
return t}}
A.bu.prototype={
i(a){return"Null check operator used on a null value"}}
A.ci.prototype={
i(a){var t,s=this,r="NoSuchMethodError: method not found: '",q=s.b
if(q==null)return"NoSuchMethodError: "+s.a
t=s.c
if(t==null)return r+q+"' ("+s.a+")"
return r+q+"' on '"+t+"' ("+s.a+")"}}
A.ct.prototype={
i(a){var t=this.a
return t.length===0?"Error":"Error: "+t}}
A.dg.prototype={
i(a){return"Throw of null ('"+(this.a===null?"null":"undefined")+"' from JavaScript)"}}
A.H.prototype={
i(a){var t=this.constructor,s=t==null?null:t.name
return"Closure '"+A.fy(s==null?"unknown":s)+"'"},
$ia3:1,
gc6(){return this},
$C:"$1",
$R:1,
$D:null}
A.bZ.prototype={$C:"$0",$R:0}
A.c_.prototype={$C:"$2",$R:2}
A.cr.prototype={}
A.cq.prototype={
i(a){var t=this.$static_name
if(t==null)return"Closure of unknown static method"
return"Closure '"+A.fy(t)+"'"}}
A.aK.prototype={
N(a,b){if(b==null)return!1
if(this===b)return!0
if(!(b instanceof A.aK))return!1
return this.$_target===b.$_target&&this.a===b.a},
gu(a){return(A.fv(this.a)^A.cm(this.$_target))>>>0},
i(a){return"Closure '"+this.$_name+"' of "+("Instance of '"+A.cn(this.a)+"'")}}
A.co.prototype={
i(a){return"RuntimeError: "+this.a}}
A.a5.prototype={
gm(a){return this.a},
gF(a){return this.a===0},
gW(){return new A.O(this,A.r(this).h("O<1>"))},
C(a){var t,s
if(typeof a=="string"){t=this.b
if(t==null)return!1
return t[a]!=null}else if(typeof a=="number"&&(a&0x3fffffff)===a){s=this.c
if(s==null)return!1
return s[a]!=null}else return this.bO(a)},
bO(a){var t=this.d
if(t==null)return!1
return this.aq(t[this.ap(a)],a)>=0},
j(a,b){var t,s,r,q,p=null
if(typeof b=="string"){t=this.b
if(t==null)return p
s=t[b]
r=s==null?p:s.b
return r}else if(typeof b=="number"&&(b&0x3fffffff)===b){q=this.c
if(q==null)return p
s=q[b]
r=s==null?p:s.b
return r}else return this.bP(b)},
bP(a){var t,s,r=this.d
if(r==null)return null
t=r[this.ap(a)]
s=this.aq(t,a)
if(s<0)return null
return t[s].b},
l(a,b,c){var t,s,r=this,q=A.r(r)
q.c.a(b)
q.y[1].a(c)
if(typeof b=="string"){t=r.b
r.aC(t==null?r.b=r.ae():t,b,c)}else if(typeof b=="number"&&(b&0x3fffffff)===b){s=r.c
r.aC(s==null?r.c=r.ae():s,b,c)}else r.bQ(b,c)},
bQ(a,b){var t,s,r,q,p=this,o=A.r(p)
o.c.a(a)
o.y[1].a(b)
t=p.d
if(t==null)t=p.d=p.ae()
s=p.ap(a)
r=t[s]
if(r==null)t[s]=[p.a5(a,b)]
else{q=p.aq(r,a)
if(q>=0)r[q].b=b
else r.push(p.a5(a,b))}},
a1(a,b){var t,s,r=this,q=A.r(r)
q.c.a(a)
q.h("2()").a(b)
if(r.C(a)){t=r.j(0,a)
return t==null?q.y[1].a(t):t}s=b.$0()
r.l(0,a,s)
return s},
M(a,b){var t,s,r=this
A.r(r).h("~(1,2)").a(b)
t=r.e
s=r.r
while(t!=null){b.$2(t.a,t.b)
if(s!==r.r)throw A.b(A.T(r))
t=t.c}},
aC(a,b,c){var t,s=A.r(this)
s.c.a(b)
s.y[1].a(c)
t=a[b]
if(t==null)a[b]=this.a5(b,c)
else t.b=c},
a5(a,b){var t=this,s=A.r(t),r=new A.da(s.c.a(a),s.y[1].a(b))
if(t.e==null)t.e=t.f=r
else t.f=t.f.c=r;++t.a
t.r=t.r+1&1073741823
return r},
ap(a){return J.S(a)&1073741823},
aq(a,b){var t,s
if(a==null)return-1
t=a.length
for(s=0;s<t;++s)if(J.aJ(a[s].a,b))return s
return-1},
i(a){return A.de(this)},
ae(){var t=Object.create(null)
t["<non-identifier-key>"]=t
delete t["<non-identifier-key>"]
return t},
$ieP:1}
A.da.prototype={}
A.O.prototype={
gm(a){return this.a.a},
gF(a){return this.a.a===0},
gq(a){var t=this.a
return new A.bl(t,t.r,t.e,this.$ti.h("bl<1>"))}}
A.bl.prototype={
gp(){return this.d},
n(){var t,s=this,r=s.a
if(s.b!==r.r)throw A.b(A.T(r))
t=s.c
if(t==null){s.d=null
return!1}else{s.d=t.a
s.c=t.c
return!0}},
$iL:1}
A.X.prototype={
gm(a){return this.a.a},
gq(a){var t=this.a
return new A.bm(t,t.r,t.e,this.$ti.h("bm<1>"))}}
A.bm.prototype={
gp(){return this.d},
n(){var t,s=this,r=s.a
if(s.b!==r.r)throw A.b(A.T(r))
t=s.c
if(t==null){s.d=null
return!1}else{s.d=t.b
s.c=t.c
return!0}},
$iL:1}
A.dU.prototype={
$1(a){return this.a(a)},
$S:3}
A.dV.prototype={
$2(a,b){return this.a(a,b)},
$S:8}
A.dW.prototype={
$1(a){return this.a(A.aD(a))},
$S:9}
A.ay.prototype={
i(a){return this.aO(!1)},
aO(a){var t,s,r,q,p,o=this.bk(),n=this.aG(),m=(a?"Record ":"")+"("
for(t=o.length,s="",r=0;r<t;++r,s=", "){m+=s
q=o[r]
if(typeof q=="string")m=m+q+": "
if(!(r<n.length))return A.a(n,r)
p=n[r]
m=a?m+A.eT(p):m+A.j(p)}m+=")"
return m.charCodeAt(0)==0?m:m},
bk(){var t,s=this.$s
while($.dA.length<=s)B.a.k($.dA,null)
t=$.dA[s]
if(t==null){t=this.bh()
B.a.l($.dA,s,t)}return t},
bh(){var t,s,r,q=this.$r,p=q.indexOf("("),o=q.substring(1,p),n=q.substring(p),m=n==="()"?0:n.replace(/[^,]/g,"").length+1,l=u.K,k=J.cg(m,l)
for(t=0;t<m;++t)k[t]=t
if(o!==""){s=o.split(",")
t=s.length
for(r=m;t>0;){--r;--t
B.a.l(k,r,s[t])}}return A.z(k,l)}}
A.aV.prototype={
aG(){return[this.a,this.b,this.c]},
N(a,b){var t=this
if(b==null)return!1
return b instanceof A.aV&&t.$s===b.$s&&J.aJ(t.a,b.a)&&J.aJ(t.b,b.b)&&J.aJ(t.c,b.c)},
gu(a){var t=this
return A.eR(t.$s,t.a,t.b,t.c)}}
A.aS.prototype={
gJ(a){return B.a3},
$iI:1}
A.bs.prototype={
bl(a,b,c,d){var t=A.a8(b,0,c,d,null)
throw A.b(t)},
aE(a,b,c,d){if(b>>>0!==b||b>c)this.bl(a,b,c,d)}}
A.a0.prototype={
gm(a){return a.length},
bv(a,b,c,d,e){var t,s,r=a.length
this.aE(a,b,r,"start")
this.aE(a,c,r,"end")
if(b>c)throw A.b(A.a8(b,0,c,null,null))
t=c-b
s=d.length
if(s-e<t)throw A.b(A.aj("Not enough elements"))
if(e!==0||s!==t)d=d.subarray(e,e+t)
a.set(d,b)},
$iaO:1}
A.bq.prototype={
j(a,b){A.y(b)
A.ek(b,a,a.length)
return a[b]},
l(a,b,c){A.aC(c)
a.$flags&2&&A.m(a)
A.ek(b,a,a.length)
a[b]=c},
a4(a,b,c,d){u.l.a(d)
a.$flags&2&&A.m(a,5)
this.bv(a,b,c,d,0)
return},
$ie:1,
$if:1}
A.br.prototype={
a4(a,b,c,d){u.Y.a(d)
a.$flags&2&&A.m(a,5)
this.b4(a,b,c,d,0)},
$ie:1,
$if:1}
A.bo.prototype={
gJ(a){return B.a4},
$iI:1,
$iA:1}
A.bp.prototype={
gJ(a){return B.a5},
j(a,b){A.y(b)
A.ek(b,a,a.length)
return a[b]},
$iI:1,
$ie8:1}
A.bG.prototype={}
A.bH.prototype={}
A.bI.prototype={}
A.bJ.prototype={}
A.Z.prototype={
h(a){return A.bP(v.typeUniverse,this,a)},
D(a){return A.f9(v.typeUniverse,this,a)}}
A.cw.prototype={}
A.dI.prototype={
i(a){return A.J(this.a,null)}}
A.cv.prototype={
i(a){return this.a}}
A.aW.prototype={}
A.aB.prototype={
gp(){var t=this.b
return t==null?this.$ti.c.a(t):t},
bu(a,b){var t,s,r
a=A.y(a)
b=b
t=this.a
for(;;)try{s=t(this,a,b)
return s}catch(r){b=r
a=1}},
n(){var t,s,r,q,p=this,o=null,n=0
for(;;){t=p.d
if(t!=null)try{if(t.n()){p.b=t.gp()
return!0}else p.d=null}catch(s){o=s
n=1
p.d=null}r=p.bu(n,o)
if(1===r)return!0
if(0===r){p.b=null
q=p.e
if(q==null||q.length===0){p.a=A.f4
return!1}if(0>=q.length)return A.a(q,-1)
p.a=q.pop()
n=0
o=null
continue}if(2===r){n=0
o=null
continue}if(3===r){o=p.c
p.c=null
q=p.e
if(q==null||q.length===0){p.b=null
p.a=A.f4
throw o
return!1}if(0>=q.length)return A.a(q,-1)
p.a=q.pop()
n=1
continue}throw A.b(A.aj("sync*"))}return!1},
ak(a){var t,s,r=this
if(a instanceof A.am){t=a.a()
s=r.e
if(s==null)s=r.e=[]
B.a.k(s,r.a)
r.a=t
return 2}else{r.d=J.b2(a)
return 2}},
$iL:1}
A.am.prototype={
gq(a){return new A.aB(this.a(),this.$ti.h("aB<1>"))}}
A.av.prototype={
gq(a){var t=this,s=new A.aw(t,t.r,A.r(t).h("aw<1>"))
s.c=t.e
return s},
gm(a){return this.a},
an(a,b){var t
if((b&1073741823)===b){t=this.c
if(t==null)return!1
return u.g.a(t[b])!=null}else return this.bi(b)},
bi(a){var t=this.d
if(t==null)return!1
return this.ad(t[this.a8(a)],a)>=0},
k(a,b){var t,s,r=this
A.r(r).c.a(b)
if(typeof b=="string"&&b!=="__proto__"){t=r.b
return r.aD(t==null?r.b=A.eh():t,b)}else if(typeof b=="number"&&(b&1073741823)===b){s=r.c
return r.aD(s==null?r.c=A.eh():s,b)}else return r.bf(b)},
bf(a){var t,s,r,q=this
A.r(q).c.a(a)
t=q.d
if(t==null)t=q.d=A.eh()
s=q.a8(a)
r=t[s]
if(r==null)t[s]=[q.af(a)]
else{if(q.ad(r,a)>=0)return!1
r.push(q.af(a))}return!0},
aX(a,b){var t=this
if(typeof b=="string"&&b!=="__proto__")return t.aM(t.b,b)
else if(typeof b=="number"&&(b&1073741823)===b)return t.aM(t.c,b)
else return t.bt(b)},
bt(a){var t,s,r,q,p=this,o=p.d
if(o==null)return!1
t=p.a8(a)
s=o[t]
r=p.ad(s,a)
if(r<0)return!1
q=s.splice(r,1)[0]
if(0===s.length)delete o[t]
p.aP(q)
return!0},
aD(a,b){A.r(this).c.a(b)
if(u.g.a(a[b])!=null)return!1
a[b]=this.af(b)
return!0},
aM(a,b){var t
if(a==null)return!1
t=u.g.a(a[b])
if(t==null)return!1
this.aP(t)
delete a[b]
return!0},
aI(){this.r=this.r+1&1073741823},
af(a){var t,s=this,r=new A.cz(A.r(s).c.a(a))
if(s.e==null)s.e=s.f=r
else{t=s.f
t.toString
r.c=t
s.f=t.b=r}++s.a
s.aI()
return r},
aP(a){var t=this,s=a.c,r=a.b
if(s==null)t.e=r
else s.b=r
if(r==null)t.f=s
else r.c=s;--t.a
t.aI()},
a8(a){return J.S(a)&1073741823},
ad(a,b){var t,s
if(a==null)return-1
t=a.length
for(s=0;s<t;++s)if(J.aJ(a[s].a,b))return s
return-1}}
A.cz.prototype={}
A.aw.prototype={
gp(){var t=this.d
return t==null?this.$ti.c.a(t):t},
n(){var t=this,s=t.c,r=t.a
if(t.b!==r.r)throw A.b(A.T(r))
else if(s==null){t.d=null
return!1}else{t.d=t.$ti.h("1?").a(s.a)
t.c=s.b
return!0}},
$iL:1}
A.db.prototype={
$2(a,b){this.a.l(0,this.b.a(a),this.c.a(b))},
$S:10}
A.u.prototype={
gq(a){return new A.as(a,a.length,A.G(a).h("as<u.E>"))},
H(a,b){if(!(b>=0&&b<a.length))return A.a(a,b)
return a[b]},
gF(a){return a.length===0},
gaT(a){return a.length!==0},
bK(a,b){var t,s,r
A.G(a).h("o(u.E)").a(b)
t=a.length
for(s=t,r=0;r<t;++r){if(!(r<s))return A.a(a,r)
if(!b.$1(a[r]))return!1
s=a.length
if(t!==s)throw A.b(A.T(a))}return!0},
O(a,b){var t,s,r
A.G(a).h("o(u.E)").a(b)
t=a.length
for(s=t,r=0;r<t;++r){if(!(r<s))return A.a(a,r)
if(b.$1(a[r]))return!0
s=a.length
if(t!==s)throw A.b(A.T(a))}return!1},
aU(a,b,c){var t=A.G(a)
return new A.a7(a,t.D(c).h("1(u.E)").a(b),t.h("@<u.E>").D(c).h("a7<1,2>"))},
aY(a,b){return A.dp(a,0,A.eq(b,"count",u.S),A.G(a).h("u.E"))},
k(a,b){var t
A.G(a).h("u.E").a(b)
t=a.length
this.sm(a,t+1)
if(!(t<a.length))return A.a(a,t)
a[t]=b},
T(a,b,c,d){var t,s
A.G(a).h("u.E?").a(d)
t=a.length
A.ee(b,c,t)
for(s=b;s<c;++s){if(!(s<t))return A.a(a,s)
a[s]=d}},
az(a,b,c,d,e){var t,s,r,q,p,o
A.G(a).h("e<u.E>").a(d)
t=a.length
A.ee(b,c,t)
s=c-b
if(s===0)return
A.dk(e,"skipCount")
r=d.length
if(e+s>r)throw A.b(A.aj("Too few elements"))
if(e<b)for(q=s-1;q>=0;--q){p=b+q
o=e+q
if(!(o<r))return A.a(d,o)
o=d[o]
if(!(p<t))return A.a(a,p)
a[p]=o}else for(q=0;q<s;++q){p=b+q
o=e+q
if(!(o<r))return A.a(d,o)
o=d[o]
if(!(p<t))return A.a(a,p)
a[p]=o}},
a4(a,b,c,d){return this.az(a,b,c,d,0)},
G(a,b,c){A.G(a).h("e<u.E>").a(c)
this.a4(a,b,b+c.length,c)},
i(a){return A.e9(a,"[","]")}}
A.Q.prototype={
M(a,b){var t,s,r,q=A.r(this)
q.h("~(Q.K,Q.V)").a(b)
for(t=this.gW(),t=t.gq(t),q=q.h("Q.V");t.n();){s=t.gp()
r=this.j(0,s)
b.$2(s,r==null?q.a(r):r)}},
gm(a){var t=this.gW()
return t.gm(t)},
gF(a){var t=this.gW()
return t.gF(t)},
i(a){return A.de(this)},
$iP:1}
A.df.prototype={
$2(a,b){var t,s=this.a
if(!s.a)this.b.a+=", "
s.a=!1
s=this.b
t=A.j(a)
s.a=(s.a+=t)+": "
t=A.j(b)
s.a+=t},
$S:4}
A.bQ.prototype={}
A.aR.prototype={
j(a,b){return this.a.j(0,b)},
M(a,b){this.a.M(0,this.$ti.h("~(1,2)").a(b))},
gF(a){return this.a.a===0},
gm(a){return this.a.a},
i(a){return A.de(this.a)},
$iP:1}
A.bC.prototype={}
A.ai.prototype={
L(a,b){var t
for(t=J.b2(A.r(this).h("e<1>").a(b));t.n();)this.k(0,t.gp())},
c_(a){var t,s,r
for(t=A.eZ(a,a.r,A.r(a).c),s=t.$ti.c;t.n();){r=t.d
this.aX(0,r==null?s.a(r):r)}},
i(a){return A.e9(this,"{","}")},
$ie:1,
$iah:1}
A.bL.prototype={}
A.aX.prototype={}
A.cx.prototype={
j(a,b){var t,s=this.b
if(s==null)return this.c.j(0,b)
else if(typeof b!="string")return null
else{t=s[b]
return typeof t=="undefined"?this.bs(b):t}},
gm(a){return this.b==null?this.c.a:this.a_().length},
gF(a){return this.gm(0)===0},
gW(){if(this.b==null){var t=this.c
return new A.O(t,A.r(t).h("O<1>"))}return new A.cy(this)},
M(a,b){var t,s,r,q,p=this
u.cQ.a(b)
if(p.b==null)return p.c.M(0,b)
t=p.a_()
for(s=0;s<t.length;++s){r=t[s]
q=p.b[r]
if(typeof q=="undefined"){q=A.dM(p.a[r])
p.b[r]=q}b.$2(r,q)
if(t!==p.c)throw A.b(A.T(p))}},
a_(){var t=u.aL.a(this.c)
if(t==null)t=this.c=A.d(Object.keys(this.a),u.s)
return t},
bs(a){var t
if(!Object.prototype.hasOwnProperty.call(this.a,a))return null
t=A.dM(this.a[a])
return this.b[a]=t}}
A.cy.prototype={
gm(a){return this.a.gm(0)},
H(a,b){var t=this.a
if(t.b==null)t=t.gW().H(0,b)
else{t=t.a_()
if(!(b>=0&&b<t.length))return A.a(t,b)
t=t[b]}return t},
gq(a){var t=this.a
if(t.b==null){t=t.gW()
t=t.gq(t)}else{t=t.a_()
t=new J.ap(t,t.length,A.C(t).h("ap<1>"))}return t}}
A.c0.prototype={}
A.c2.prototype={}
A.bk.prototype={
i(a){var t=A.c5(this.a)
return(this.b!=null?"Converting object to an encodable object failed:":"Converting object did not return an encodable object:")+" "+t}}
A.cj.prototype={
i(a){return"Cyclic error in JSON stringify"}}
A.d7.prototype={
bD(a,b){var t=A.hY(a,this.gbE().a)
return t},
ao(a,b){var t=A.hd(a,this.gbH().b,null)
return t},
gbH(){return B.Z},
gbE(){return B.Y}}
A.d9.prototype={}
A.d8.prototype={}
A.dw.prototype={
b_(a){var t,s,r,q,p,o,n=a.length
for(t=this.c,s=0,r=0;r<n;++r){q=a.charCodeAt(r)
if(q>92){if(q>=55296){p=q&64512
if(p===55296){o=r+1
o=!(o<n&&(a.charCodeAt(o)&64512)===56320)}else o=!1
if(!o)if(p===56320){p=r-1
p=!(p>=0&&(a.charCodeAt(p)&64512)===55296)}else p=!1
else p=!0
if(p){if(r>s)t.a+=B.m.Z(a,s,r)
s=r+1
p=A.B(92)
t.a+=p
p=A.B(117)
t.a+=p
p=A.B(100)
t.a+=p
p=q>>>8&15
p=A.B(p<10?48+p:87+p)
t.a+=p
p=q>>>4&15
p=A.B(p<10?48+p:87+p)
t.a+=p
p=q&15
p=A.B(p<10?48+p:87+p)
t.a+=p}}continue}if(q<32){if(r>s)t.a+=B.m.Z(a,s,r)
s=r+1
p=A.B(92)
t.a+=p
switch(q){case 8:p=A.B(98)
t.a+=p
break
case 9:p=A.B(116)
t.a+=p
break
case 10:p=A.B(110)
t.a+=p
break
case 12:p=A.B(102)
t.a+=p
break
case 13:p=A.B(114)
t.a+=p
break
default:p=A.B(117)
t.a+=p
p=A.B(48)
t.a=(t.a+=p)+p
p=q>>>4&15
p=A.B(p<10?48+p:87+p)
t.a+=p
p=q&15
p=A.B(p<10?48+p:87+p)
t.a+=p
break}}else if(q===34||q===92){if(r>s)t.a+=B.m.Z(a,s,r)
s=r+1
p=A.B(92)
t.a+=p
p=A.B(q)
t.a+=p}}if(s===0)t.a+=a
else if(s<n)t.a+=B.m.Z(a,s,n)},
a6(a){var t,s,r,q
for(t=this.a,s=t.length,r=0;r<s;++r){q=t[r]
if(a==null?q==null:a===q)throw A.b(new A.cj(a,null))}B.a.k(t,a)},
a2(a){var t,s,r,q,p=this
if(p.aZ(a))return
p.a6(a)
try{t=p.b.$1(a)
if(!p.aZ(t)){r=A.eN(a,null,p.gaK())
throw A.b(r)}r=p.a
if(0>=r.length)return A.a(r,-1)
r.pop()}catch(q){s=A.ex(q)
r=A.eN(a,s,p.gaK())
throw A.b(r)}},
aZ(a){var t,s,r=this
if(typeof a=="number"){if(!isFinite(a))return!1
r.c.a+=B.l.i(a)
return!0}else if(a===!0){r.c.a+="true"
return!0}else if(a===!1){r.c.a+="false"
return!0}else if(a==null){r.c.a+="null"
return!0}else if(typeof a=="string"){t=r.c
t.a+='"'
r.b_(a)
t.a+='"'
return!0}else if(u.j.b(a)){r.a6(a)
r.c4(a)
t=r.a
if(0>=t.length)return A.a(t,-1)
t.pop()
return!0}else if(u.f.b(a)){r.a6(a)
s=r.c5(a)
t=r.a
if(0>=t.length)return A.a(t,-1)
t.pop()
return s}else return!1},
c4(a){var t,s=this.c
s.a+="["
if(J.fN(a)){if(0>=a.length)return A.a(a,0)
this.a2(a[0])
for(t=1;t<a.length;++t){s.a+=","
this.a2(a[t])}}s.a+="]"},
c5(a){var t,s,r,q,p,o,n=this,m={}
if(a.gF(a)){n.c.a+="{}"
return!0}t=a.gm(a)*2
s=A.a6(t,null,!1,u.X)
r=m.a=0
m.b=!0
a.M(0,new A.dx(m,s))
if(!m.b)return!1
q=n.c
q.a+="{"
for(p='"';r<t;r+=2,p=',"'){q.a+=p
n.b_(A.aD(s[r]))
q.a+='":'
o=r+1
if(!(o<t))return A.a(s,o)
n.a2(s[o])}q.a+="}"
return!0}}
A.dx.prototype={
$2(a,b){var t,s
if(typeof a!="string")this.a.b=!1
t=this.b
s=this.a
B.a.l(t,s.a++,a)
B.a.l(t,s.a++,b)},
$S:4}
A.dv.prototype={
gaK(){var t=this.c.a
return t.charCodeAt(0)==0?t:t}}
A.c4.prototype={
N(a,b){if(b==null)return!1
return b instanceof A.c4&&this.a===b.a},
gu(a){return B.f.gu(this.a)},
i(a){var t,s,r,q,p,o=this.a,n=B.f.aj(o,36e8),m=o%36e8
if(o<0){n=0-n
o=0-m
t="-"}else{o=m
t=""}s=B.f.aj(o,6e7)
o%=6e7
r=s<10?"0":""
q=B.f.aj(o,1e6)
p=q<10?"0":""
return t+n+":"+r+s+":"+p+q+"."+B.m.bU(B.f.i(o%1e6),6,"0")}}
A.dt.prototype={
i(a){return this.aa()}}
A.p.prototype={}
A.bX.prototype={
i(a){var t=this.a
if(t!=null)return"Assertion failed: "+A.c5(t)
return"Assertion failed"}}
A.bA.prototype={}
A.a2.prototype={
gac(){return"Invalid argument"+(!this.a?"(s)":"")},
gab(){return""},
i(a){var t=this,s=t.c,r=s==null?"":" ("+s+")",q=t.d,p=q==null?"":": "+A.j(q),o=t.gac()+r+p
if(!t.a)return o
return o+t.gab()+": "+A.c5(t.gar())},
gar(){return this.b}}
A.bv.prototype={
gar(){return A.fd(this.b)},
gac(){return"RangeError"},
gab(){var t,s=this.e,r=this.f
if(s==null)t=r!=null?": Not less than or equal to "+A.j(r):""
else if(r==null)t=": Not greater than or equal to "+A.j(s)
else if(r>s)t=": Not in inclusive range "+A.j(s)+".."+A.j(r)
else t=r<s?": Valid value range is empty":": Only valid value is "+A.j(s)
return t}}
A.be.prototype={
gar(){return A.y(this.b)},
gac(){return"RangeError"},
gab(){if(A.y(this.b)<0)return": index must not be negative"
var t=this.f
if(t===0)return": no indices are valid"
return": index should be less than "+t},
gm(a){return this.f}}
A.bD.prototype={
i(a){return"Unsupported operation: "+this.a}}
A.cs.prototype={
i(a){return"UnimplementedError: "+this.a}}
A.by.prototype={
i(a){return"Bad state: "+this.a}}
A.c1.prototype={
i(a){var t=this.a
if(t==null)return"Concurrent modification during iteration."
return"Concurrent modification during iteration: "+A.c5(t)+"."}}
A.ck.prototype={
i(a){return"Out of Memory"},
$ip:1}
A.bx.prototype={
i(a){return"Stack Overflow"},
$ip:1}
A.c7.prototype={
i(a){var t=this.a,s=""!==t?"FormatException: "+t:"FormatException"
return s}}
A.e.prototype={
bZ(a,b){var t,s
A.r(this).h("e.E(e.E,e.E)").a(b)
t=this.gq(this)
if(!t.n())throw A.b(A.d5())
s=t.gp()
while(t.n())s=b.$2(s,t.gp())
return s},
gm(a){var t,s=this.gq(this)
for(t=0;s.n();)++t
return t},
H(a,b){var t,s
A.dk(b,"index")
t=this.gq(this)
for(s=b;t.n();){if(s===0)return t.gp();--s}throw A.b(A.e7(b,b-s,this,"index"))},
i(a){return A.h_(this,"(",")")}}
A.bt.prototype={
gu(a){return A.q.prototype.gu.call(this,0)},
i(a){return"null"}}
A.q.prototype={$iq:1,
N(a,b){return this===b},
gu(a){return A.cm(this)},
i(a){return"Instance of '"+A.cn(this)+"'"},
gJ(a){return A.ie(this)},
toString(){return this.i(this)}}
A.dn.prototype={
gbG(){var t,s=this.b
if(s==null)s=$.dj.$0()
t=s-this.a
if($.ez()===1e6)return t
return t*1000}}
A.aT.prototype={
gm(a){return this.a.length},
i(a){var t=this.a
return t.charCodeAt(0)==0?t:t},
$iha:1}
A.v.prototype={
a7(a){var t
if(typeof a=="number"){t=this.b.length
if(t===0)t=$.ad()
else t=new Float64Array(t)
return new A.v(a,t)}if(!(a instanceof A.v)||a.b.length!==this.b.length)throw A.b(A.l("Dual operands must have the same local dimension."))
return a},
A(a,b){var t,s,r,q,p,o,n,m,l=this.a7(b),k=this.b,j=k.length
if(j===0)t=$.ad()
else t=new Float64Array(j)
for(s=t.length,r=l.b,q=r.length,p=t.$flags|0,o=0;o<s;++o){if(!(o<j))return A.a(k,o)
n=k[o]
if(!(o<q))return A.a(r,o)
m=r[o]
p&2&&A.m(t)
t[o]=n+m}return new A.v(this.a+l.a,t)},
V(a,b){var t,s,r,q,p,o,n,m,l=this.a7(b),k=this.b,j=k.length
if(j===0)t=$.ad()
else t=new Float64Array(j)
for(s=t.length,r=l.b,q=r.length,p=t.$flags|0,o=0;o<s;++o){if(!(o<j))return A.a(k,o)
n=k[o]
if(!(o<q))return A.a(r,o)
m=r[o]
p&2&&A.m(t)
t[o]=n-m}return new A.v(this.a-l.a,t)},
t(a,b){var t,s,r,q,p,o,n,m,l,k,j=this.a7(b),i=this.b,h=i.length
if(h===0)t=$.ad()
else t=new Float64Array(h)
for(s=t.length,r=j.a,q=this.a,p=j.b,o=p.length,n=t.$flags|0,m=0;m<s;++m){if(!(m<h))return A.a(i,m)
l=i[m]
if(!(m<o))return A.a(p,m)
k=p[m]
n&2&&A.m(t)
t[m]=l*r+q*k}return new A.v(q*r,t)},
i(a){return"Dual("+A.j(this.a)+", "+A.j(this.b)+")"}}
A.dm.prototype={
ba(a,b,c,d,e){var t,s,r,q,p=this,o=p.a,n=!0,m=p.c,l=m.length
if(l===o+1){t=p.e.length
if(p.d.length===t){if(0>=l)return A.a(m,0)
if(m[0]===0){if(l===0)A.V(A.d5())
n=l-1
if(!(n>=0))return A.a(m,n)
t=m[n]!==t
n=t}}}if(n)throw A.b(A.l("Invalid sparse Jacobian dimensions."))
for(n=p.c,m=n.length,s=0;s<o;){if(!(s<m))return A.a(n,s)
l=n[s];++s
if(!(s<m))return A.a(n,s)
if(l>n[s])throw A.b(A.l("Sparse row offsets must be nondecreasing."))}for(o=p.d,n=o.length,m=p.b,r=0;r<n;++r){q=o[r]
if(q<0||q>=m)throw A.b(A.l("Sparse Jacobian column out of range."))}},
U(a,b){var t,s,r,q,p,o,n,m,l,k,j,i,h,g,f,e=this
for(t=e.a,s=b.$flags|0,r=e.c,q=r.length,p=e.e,o=p.length,n=e.d,m=n.length,l=a.length,k=0;k<t;k=i){if(!(k<q))return A.a(r,k)
j=r[k]
i=k+1
if(!(i<q))return A.a(r,i)
h=0
for(;j<r[i];++j){if(!(j>=0&&j<o))return A.a(p,j)
g=p[j]
if(!(j<m))return A.a(n,j)
f=n[j]
if(!(f>=0&&f<l))return A.a(a,f)
h+=g*a[f]}s&2&&A.m(b)
if(!(k<b.length))return A.a(b,k)
b[k]=h}},
P(a,b){var t,s,r,q,p,o,n,m,l,k,j,i,h,g,f,e,d,c=this
B.b.T(b,0,c.b,0)
for(t=c.a,s=c.c,r=s.length,q=c.d,p=q.length,o=b.length,n=c.e,m=n.length,l=a.length,k=b.$flags|0,j=0;j<t;j=h){if(!(j<r))return A.a(s,j)
i=s[j]
h=j+1
if(!(h<r))return A.a(s,h)
for(;i<s[h];++i){if(!(i>=0&&i<p))return A.a(q,i)
g=q[i]
if(!(g>=0&&g<o))return A.a(b,g)
f=b[g]
if(!(i<m))return A.a(n,i)
e=n[i]
if(!(j<l))return A.a(a,j)
d=a[j]
k&2&&A.m(b)
b[g]=f+e*d}}},
aV(a){var t,s,r,q,p,o,n,m,l,k
B.b.T(a,0,this.b,0)
for(t=this.e,s=t.length,r=this.d,q=r.length,p=a.length,o=a.$flags|0,n=0;n<s;++n){if(!(n<q))return A.a(r,n)
m=r[n]
if(!(m>=0&&m<p))return A.a(a,m)
l=a[m]
k=t[n]
o&2&&A.m(a)
a[m]=l+k*k}},
c0(){var t,s,r,q,p,o,n,m,l,k,j,i,h,g=this,f=g.a,e=g.b,d=f*e,c=new Float64Array(d)
for(t=g.c,s=t.length,r=g.d,q=r.length,p=g.e,o=p.length,n=0;n<f;n=l){if(!(n<s))return A.a(t,n)
m=t[n]
l=n+1
if(!(l<s))return A.a(t,l)
k=n*e
for(;m<t[l];++m){if(!(m>=0&&m<q))return A.a(r,m)
j=k+r[m]
if(!(j>=0&&j<d))return A.a(c,j)
i=c[j]
if(!(m<o))return A.a(p,m)
h=p[m]
if(!(j<d))return A.a(c,j)
c[j]=i+h}}return c}}
A.ae.prototype={
aa(){return"GeometryLinearStatus."+this.b}}
A.K.prototype={}
A.c3.prototype={
aA(a8,a9,b0,b1,b2,b3,b4){var t,s,r,q,p,o,n,m,l,k,j,i,h,g,f,e,d,c,b,a,a0,a1,a2,a3,a4,a5,a6,a7
u.F.a(b4)
t=a8.b
s=a8.a
r=s+t
q=r*t
p=new Float64Array(q)
o=new Float64Array(r)
for(n=a8.c,m=n.length,l=a8.d,k=l.length,j=a8.e,i=j.length,h=a9.length,g=0;g<s;g=d){if(!(g<h))return A.a(a9,g)
f=a9[g]
if(!(g<r))return A.a(o,g)
o[g]=-f
if(!(g<m))return A.a(n,g)
e=n[g]
d=g+1
if(!(d<m))return A.a(n,d)
f=g*t
for(;e<n[d];++e){if(!(e>=0&&e<k))return A.a(l,e)
c=f+l[e]
if(!(c>=0&&c<q))return A.a(p,c)
b=p[c]
if(!(e<i))return A.a(j,e)
a=j[e]
if(!(c<q))return A.a(p,c)
p[c]=b+a}}for(n=b1.length,a0=0;a0<t;++a0){m=(s+a0)*t+a0
if(!(a0<n))return A.a(b1,a0)
l=Math.sqrt(b0*b1[a0])
if(!(m<q))return A.a(p,m)
p[m]=l}a1=A.el(p,r,t,o,1e-14,b4,b2)
if(a1.c)return new A.K(B.i,new Float64Array(t),a1.a)
if(a1.e)return new A.K(B.h,new Float64Array(t),a1.a)
if(!a1.d||a1.a<t)return new A.K(B.e,new Float64Array(t),a1.a)
a2=new Float64Array(t)
for(a3=t-1;a3>=0;--a3){if(!(a3<r))return A.a(o,a3)
a4=o[a3]
for(a5=a3+1,s=a3*t;a5<t;++a5){n=s+a5
if(!(n>=0&&n<q))return A.a(p,n)
a4-=p[n]*a2[a5]}s+=a3
if(!(s>=0&&s<q))return A.a(p,s)
s=p[s]
if(!(a3<t))return A.a(a2,a3)
a2[a3]=a4/s}a6=new Float64Array(t)
for(s=a1.b,q=s.length,a3=0;a3<t;++a3){if(!(a3<q))return A.a(s,a3)
n=s[a3]
m=a2[a3]
if(!(n>=0&&n<t))return A.a(a6,n)
a6[n]=m}a7=A.eo(a8,a9,b1,b0,a6)
return new A.K(isFinite(a7)&&a7<=Math.max(b3,1e-10)?B.d:B.e,a6,t)},
$ic8:1}
A.cp.prototype={
aA(a4,a5,a6,a7,a8,a9,b0){var t,s,r,q,p,o,n,m,l,k,j,i,h,g,f,e,d,c,b,a,a0,a1,a2,a3
u.F.a(b0)
t=a4.b
s=new Float64Array(t)
r=new Float64Array(t)
a4.P(a5,r)
for(q=0;q<t;++q){p=r[q]
if(!(q<t))return A.a(r,q)
r[q]=-p}o=A.M(r)
if(!isFinite(o))return new A.K(B.e,s,0)
if(o===0)return new A.K(B.d,s,0)
n=new Float64Array(t)
a4.aV(n)
m=new Float64Array(t)
l=new Float64Array(t)
k=new Float64Array(t)
p=a4.a
j=new Float64Array(p)
for(i=a7.length,q=0;q<t;++q){h=n[q]
if(!(q<i))return A.a(a7,q)
g=a7[q]
if(!(q<t))return A.a(n,q)
n[q]=h+a6*g
h=n[q]
if(!isFinite(h)||h<=0)return new A.K(B.e,s,0)
g=r[q]
if(!(q<t))return A.a(m,q)
m[q]=g/h
h=m[q]
if(!(q<t))return A.a(l,q)
l[q]=h}f=A.a1(r,m)
for(h=a5.length,e=0;e<a8;++e){g=b0.$0()
if(g==null?!1:g)return new A.K(B.i,s,e)
a4.U(l,j)
a4.P(j,k)
for(q=0;q<t;++q){g=k[q]
if(!(q<i))return A.a(a7,q)
d=a7[q]
c=l[q]
if(!(q<t))return A.a(k,q)
k[q]=g+a6*d*c}b=A.a1(l,k)
if(!isFinite(b)||b<=0||!isFinite(f))return new A.K(B.e,s,e)
a=f/b
for(q=0;q<t;++q){g=s[q]
d=l[q]
if(!(q<t))return A.a(s,q)
s[q]=g+a*d
d=r[q]
g=k[q]
if(!(q<t))return A.a(r,q)
r[q]=d-a*g}a0=A.M(r)/o
if(!isFinite(a0))return new A.K(B.e,s,e+1)
if(a0<=a9){if(A.eo(a4,a5,a7,a6,s)<=a9)return new A.K(B.d,s,e+1)
a4.U(s,j)
for(a1=0;a1<p;++a1){g=j[a1]
if(!(a1<h))return A.a(a5,a1)
d=a5[a1]
if(!(a1<p))return A.a(j,a1)
j[a1]=g+d}a4.P(j,r)
for(q=0;q<t;++q){g=r[q]
if(!(q<i))return A.a(a7,q)
d=a7[q]
c=s[q]
if(!(q<t))return A.a(r,q)
r[q]=-g-a6*d*c
c=r[q]
d=n[q]
if(!(q<t))return A.a(m,q)
m[q]=c/d
d=m[q]
if(!(q<t))return A.a(l,q)
l[q]=d}f=A.a1(r,m)
continue}for(q=0;q<t;++q){g=r[q]
d=n[q]
if(!(q<t))return A.a(m,q)
m[q]=g/d}a2=A.a1(r,m)
a3=a2/f
for(q=0;q<t;++q){g=m[q]
d=l[q]
if(!(q<t))return A.a(l,q)
l[q]=g+a3*d}f=a2}return new A.K(A.eo(a4,a5,a7,a6,s)<=a9?B.d:B.h,s,e)},
$ic8:1}
A.bW.prototype={$ic8:1}
A.d_.prototype={}
A.ar.prototype={}
A.e_.prototype={
$4(a,b,c,d){var t,s,r=this,q=new Float64Array(r.a)
r.b.U(a,q)
t=r.c
s=t===0?A.M(q):A.M(q)/t
if(c===B.d)t=!isFinite(s)||s>Math.max(1e-12,r.d*10)
else t=!1
return new A.ar(t?B.e:c,a)},
$3(a,b,c){return this.$4(a,b,c,null)},
$S:11}
A.e0.prototype={
$1(a){var t,s,r,q,p,o,n,m,l,k,j,i,h=this,g=h.a,f=g.length
if(!(a>=0&&a<f))return A.a(g,a)
t=g[a]
for(s=a+1,r=h.b,q=h.c,p=h.d,o=q.length,n=s,m=t,l=1;n<r;++n){k=n*p+a
if(!(k>=0&&k<o))return A.a(q,k)
j=q[k]
l+=j*j
if(!(n<f))return A.a(g,n)
m+=j*g[n]}m*=2/l
g.$flags&2&&A.m(g)
g[a]=t-m
for(;s<r;++s){if(!(s<f))return A.a(g,s)
k=g[s]
i=s*p+a
if(!(i>=0&&i<o))return A.a(q,i)
g[s]=k-q[i]*m}},
$S:12}
A.bK.prototype={}
A.dQ.prototype={
$3$cancelled$finite$iterationLimit(a,b,c){var t=this.a
return new A.bK(t.a,this.b,a,b,c,t.d,t.c,t.b)},
$0(){return this.$3$cancelled$finite$iterationLimit(!1,!0,!1)},
$1$cancelled(a){return this.$3$cancelled$finite$iterationLimit(a,!0,!1)},
$1$iterationLimit(a){return this.$3$cancelled$finite$iterationLimit(!1,!0,a)},
$1$finite(a){return this.$3$cancelled$finite$iterationLimit(!1,a,!1)},
$S:13}
A.dP.prototype={
$2(a,b){var t,s,r,q,p,o,n,m,l,k,j=this,i=j.a;++i.d
for(t=j.b,s=j.c,r=j.d,q=s.length,p=a,o=0,n=1;p<t;++p){++i.c
m=p*r+b
if(!(m<q))return A.a(s,m)
l=Math.abs(s[m])
if(!isFinite(l))return l
if(l===0)continue
if(o<l){k=o/l
n=1+n*k*k
o=l}else{k=l/o
n+=k*k}}return o===0?0:o*Math.sqrt(n)},
$S:14}
A.at.prototype={
gaS(a){return isFinite(this.a)&&isFinite(this.b)&&isFinite(this.c)},
gm(a){return A.M(A.d([this.a,this.b,this.c],u.n))},
av(){var t,s,r,q,p=this,o=p.a,n=p.b,m=p.c,l=Math.max(Math.abs(o),Math.max(Math.abs(n),Math.abs(m)))
if(!p.gaS(0)||l===0)throw A.b(A.l("A direction must be finite and nonzero."))
t=o/l
s=n/l
r=m/l
q=Math.sqrt(t*t+s*s+r*r)
return new A.at(t/q,s/q,r/q)},
i(a){return"Vec3("+A.j(this.a)+", "+A.j(this.b)+", "+A.j(this.c)+")"}}
A.bc.prototype={}
A.d2.prototype={}
A.b9.prototype={}
A.bb.prototype={}
A.cN.prototype={
bY(a,b,c){if(!b.gaS(0))throw A.b(A.l("A point must be finite."))
this.bp(A.e6(c,a,null,null,A.d([b.a,b.b,b.c],u.n)))
return new A.bc(a)},
bF(a,b,c,d){return this.X(a,A.d([b.a,c.a,d.a],u.s),1,new A.cP(),1e-7)},
bI(a,b,c){return this.X(a,A.d([b.a.a,b.b.a,c.a.a,c.b.a],u.s),1,new A.cQ(),1e-7)},
aw(a,b,c){return this.X(a,A.d([b.a,c.a.a],u.s),1,new A.cT(c),1e-7)},
bV(a,b,c){return this.X(a,A.d([b.a.a,b.b.a,c.a.a,c.b.a],u.s),3,new A.cR(),1e-9/Math.sqrt(3))},
bW(a,b,c){return this.X(a,A.d([b.a.a,b.b.a,c.a.a,c.b.a],u.s),1,new A.cS(),1e-9)},
bC(a){var t,s,r,q,p,o=this.d,n=a.a
if(o.C(n))throw A.b(A.l("Duplicate geometric constraint "+n+"."))
for(t=a.b,s=t.length,r=this.c,q=0;q<s;++q){p=t[q]
if(!r.C(p))throw A.b(A.l("Unknown parameter "+p+"."))}o.l(0,n,a)},
bp(a){var t=this.c,s=a.a
if(t.C(s))throw A.b(A.l("Duplicate geometric parameter "+s+"."))
t.l(0,s,a)},
X(a,b,c,d,e){var t,s,r,q
u.a.a(b)
u.ab.a(d)
t=A.dd(b,A.C(b).c)
s=A.ed(t,A.r(t).c)
t=A.d([],u.t)
for(r=b.length,q=0;q<b.length;b.length===r||(0,A.h)(b),++q)t.push(B.a.bM(s,b[q]))
this.bC(A.hb(new A.cO(d,t),a,s,c,1,null,e,null))}}
A.cP.prototype={
$1(a){var t,s
u.V.a(a)
if(2>=a.length)return A.a(a,2)
t=a[2]
if(0>=t.length)return A.a(t,0)
if(t[0].a<0)throw A.b(A.aj("Distance is negative."))
t=A.e5(A.aE(a[0],a[1]))
if(2>=a.length)return A.a(a,2)
s=a[2]
if(0>=s.length)return A.a(s,0)
return A.d([t.V(0,s[0])],u.W)},
$S:1}
A.cQ.prototype={
$1(a){var t
u.V.a(a)
if(1>=a.length)return A.a(a,1)
t=A.e5(A.aE(a[1],a[0]))
if(3>=a.length)return A.a(a,3)
return A.d([t.V(0,A.e5(A.aE(a[3],a[2])))],u.W)},
$S:1}
A.cT.prototype={
$1(a){var t,s,r
u.V.a(a)
t=a.length
if(0>=t)return A.a(a,0)
s=a[0]
if(1>=t)return A.a(a,1)
r=A.aE(s,a[1])
s=this.a.b
if(0>=r.length)return A.a(r,0)
t=r[0].t(0,s.a)
if(1>=r.length)return A.a(r,1)
t=t.A(0,r[1].t(0,s.b))
if(2>=r.length)return A.a(r,2)
return A.d([t.A(0,r[2].t(0,s.c))],u.W)},
$S:1}
A.cR.prototype={
$1(a){var t,s,r,q,p
u.V.a(a)
if(1>=a.length)return A.a(a,1)
t=A.cM(A.aE(a[1],a[0]))
if(3>=a.length)return A.a(a,3)
s=A.cM(A.aE(a[3],a[2]))
if(1>=t.length)return A.a(t,1)
r=t[1]
if(2>=s.length)return A.a(s,2)
r=r.t(0,s[2])
if(2>=t.length)return A.a(t,2)
q=t[2]
if(1>=s.length)return A.a(s,1)
q=r.V(0,q.t(0,s[1]))
if(2>=t.length)return A.a(t,2)
r=t[2]
if(0>=s.length)return A.a(s,0)
r=r.t(0,s[0])
if(0>=t.length)return A.a(t,0)
p=t[0]
if(2>=s.length)return A.a(s,2)
p=r.V(0,p.t(0,s[2]))
if(0>=t.length)return A.a(t,0)
r=t[0]
if(1>=s.length)return A.a(s,1)
r=r.t(0,s[1])
if(1>=t.length)return A.a(t,1)
t=t[1]
if(0>=s.length)return A.a(s,0)
return A.d([q,p,r.V(0,t.t(0,s[0]))],u.W)},
$S:1}
A.cS.prototype={
$1(a){var t,s,r,q
u.V.a(a)
if(1>=a.length)return A.a(a,1)
t=A.cM(A.aE(a[1],a[0]))
if(3>=a.length)return A.a(a,3)
s=A.cM(A.aE(a[3],a[2]))
if(0>=t.length)return A.a(t,0)
r=t[0]
if(0>=s.length)return A.a(s,0)
r=r.t(0,s[0])
if(1>=t.length)return A.a(t,1)
q=t[1]
if(1>=s.length)return A.a(s,1)
q=r.A(0,q.t(0,s[1]))
if(2>=t.length)return A.a(t,2)
t=t[2]
if(2>=s.length)return A.a(s,2)
return A.d([q.A(0,t.t(0,s[2]))],u.W)},
$S:1}
A.cO.prototype={
$1(a){var t,s,r,q,p
u.V.a(a)
t=A.d([],u.h)
for(s=this.b,r=s.length,q=0;q<s.length;s.length===r||(0,A.h)(s),++q){p=s[q]
if(!(p>=0&&p<a.length))return A.a(a,p)
t.push(a[p])}return this.a.$1(t)},
$S:1}
A.c9.prototype={
a0(a){return a.length===this.a&&B.b.bK(a,new A.cU())}}
A.cU.prototype={
$1(a){return isFinite(a)},
$S:0}
A.c6.prototype={
aW(a,b,c){var t,s,r,q,p,o,n
for(t=this.a,s=a.length,r=b.length,q=c.$flags|0,p=0;p<t;++p){if(!(p<s))return A.a(a,p)
o=a[p]
if(!(p<r))return A.a(b,p)
n=b[p]
q&2&&A.m(c)
if(!(p<c.length))return A.a(c,p)
c[p]=o+n}},
bX(a,b){var t,s,r,q,p=b.length
B.b.T(b,0,p,0)
for(t=this.a,s=b.$flags|0,r=0;r<t;++r){q=r*t+r
s&2&&A.m(b)
if(!(q<p))return A.a(b,q)
b[q]=1}}}
A.ca.prototype={
b6(a,b,c,d,e,f,g){var t,s,r,q,p,o,n,m=this,l=m.a,k=!0
if(l.length!==0){t=g.length
if(t!==0){s=m.r.a
if(s===t)if(s>0)if(m.d.length===t)if(m.e.length===t){k=m.f
k=k.length!==s||B.a.O(k,new A.cW())}}}if(k)throw A.b(A.l("Invalid parameter block "+l+"."))
for(k=g.length,t=m.d,s=t.length,r=m.e,q=r.length,p=0;p<k;++p){if(!(p<s))return A.a(t,p)
o=t[p]
if(!isNaN(o)){if(!(p<q))return A.a(r,p)
n=r[p]
o=isNaN(n)||o>n}else o=!0
if(o)throw A.b(A.l("Invalid bounds for "+l+"."))}m.bB(g)},
bB(a){var t,s,r,q,p,o,n,m=this
u.o.a(a)
if(a.length!==m.b.length||!m.r.a0(new Float64Array(A.F(a))))throw A.b(A.l("Invalid coordinates for "+m.a+"."))
for(t=a.length,s=m.d,r=s.length,q=m.e,p=q.length,o=0;o<t;++o){n=a[o]
if(!(o<r))return A.a(s,o)
if(!(n<s[o])){if(!(o<p))return A.a(q,o)
n=n>q[o]}else n=!0
if(n)throw A.b(A.l("Coordinates for "+m.a+" lie outside their bounds."))}}}
A.cW.prototype={
$1(a){A.aC(a)
return!isFinite(a)||a<=0},
$S:0}
A.bd.prototype={
b8(a,b,c,d,e,f,g,h){var t,s,r=this,q=r.a,p=!0
if(q.length!==0){t=r.c
if(t>0){s=r.b
if(A.dd(s,A.C(s).c).a===c.length){s=r.e
if(s.length===t){p=r.f
p=p.length!==t||B.a.O(s,new A.d0())||B.a.O(p,new A.d1())}}}}if(p)throw A.b(A.l("Invalid residual block "+q+"."))},
bJ(a,b,c){return this.d.$3(a,b,c)}}
A.d0.prototype={
$1(a){A.aC(a)
return!isFinite(a)||a<=0},
$S:0}
A.d1.prototype={
$1(a){A.aC(a)
return!isFinite(a)||a<=0},
$S:0}
A.aU.prototype={}
A.ds.prototype={
$3(a,b,c){A.fh(this.a,this.b,this.c,u.E.a(a),b,u.v.a(c),null,null)},
$S:15}
A.dO.prototype={
$2(a,b){return A.y(a)+u.q.a(b).length},
$S:16}
A.cV.prototype={}
A.cD.prototype={
b5(b2){var t,s,r,q,p,o,n,m,l,k,j,i,h,g,f,e,d,c,b,a,a0,a1,a2,a3,a4,a5,a6,a7,a8,a9,b0,b1=this
for(t=b1.a,s=t.length,r=b1.c,q=0;q<s;++q){if(r.C(t[q].a))throw A.b(A.l("Duplicate parameter "+t[q].a+"."))
r.l(0,t[q].a,q)}p=u.S
o=J.cg(s,p)
for(q=0;q<s;++q)o[q]=q
n=new A.cK(o)
m=A.d([],u.D)
for(l=b1.b,k=l.length,j=u.aU,i=u.bS,h=i.h("e.E"),g=b1.d,f=u.t,e=0;e<k;++e){d=l[e]
c=d.a
if(g.C(c))throw A.b(A.l("Duplicate constraint "+c+"."))
g.l(0,c,e)
b=A.d([],f)
for(c=d.b,a=c.length,a0=0;a0<a;++a0){a1=c[a0]
a2=r.j(0,a1)
if(a2==null)throw A.b(A.l("Unknown parameter "+a1+"."))
B.a.k(b,a2)}B.a.k(m,b)
a3=A.ed(new A.aa(b,j.a(new A.cE(b1)),i),h)
for(q=1;q<a3.length;++q){c=n.$1(a3[q])
if(0>=a3.length)return A.a(a3,0)
B.a.l(o,c,n.$1(a3[0]))}}r=u.aH
a4=A.E(p,r)
for(q=0;q<s;++q)if(!t[q].c)J.bU(a4.a1(n.$1(q),new A.cF()),q)
a5=A.E(p,r)
for(e=0;e<k;++e){if(!(e<m.length))return A.a(m,e)
t=m[e]
s=A.C(t)
a3=new A.aa(t,s.h("o(1)").a(new A.cG(b1)),s.h("aa<1>"))
if(!a3.gq(0).n())a6=-1
else{a7=a3.gq(0)
if(!a7.n())A.V(A.d5())
a6=n.$1(a7.gp())}J.bU(a5.a1(a6,new A.cH()),e)}t=A.eQ(p)
t.L(0,new A.O(a4,a4.$ti.h("O<1>")))
t.L(0,new A.O(a5,a5.$ti.h("O<1>")))
for(t=A.eZ(t,t.r,A.r(t).c),s=b1.e,r=b1.f,l=u.d,k=b1.r,j=t.$ti.c;t.n();){i=t.d
if(i==null)i=j.a(i)
h=k.length
g=a4.j(0,i)
if(g==null)g=B.y
i=a5.j(0,i)
if(i==null)i=B.y
f=A.d([],l)
a8=new A.au(h,g,A.E(p,p),f)
a8.bb(h,b1,g,i,m)
B.a.k(k,a8)
for(i=g.length,a0=0;a0<g.length;g.length===i||(0,A.h)(g),++a0)s.a1(g[a0],new A.cI()).k(0,h)
for(i=f.length,a0=0;a0<f.length;f.length===i||(0,A.h)(f),++a0){a9=f[a0]
r.l(0,a9.a,h)
for(g=a9.b,c=g.length,b0=0;b0<g.length;g.length===c||(0,A.h)(g),++b0)s.a1(g[b0],new A.cJ()).k(0,h)}}},
gbR(){return B.a.aR(this.r,0,new A.cL(),u.S)}}
A.cK.prototype={
$1(a){var t,s,r=this.a
for(;;){t=r.length
if(!(a>=0&&a<t))return A.a(r,a)
s=r[a]
if(!(s!==a))break
if(!(s>=0&&s<t))return A.a(r,s)
t=r[s]
if(!(a>=0&&a<r.length))return A.a(r,a)
r[a]=t
if(!(a<r.length))return A.a(r,a)
a=r[a]}return a},
$S:17}
A.cE.prototype={
$1(a){var t
A.y(a)
t=this.a.a
if(!(a>=0&&a<t.length))return A.a(t,a)
return!t[a].c},
$S:5}
A.cF.prototype={
$0(){return A.d([],u.t)},
$S:6}
A.cG.prototype={
$1(a){var t
A.y(a)
t=this.a.a
if(!(a>=0&&a<t.length))return A.a(t,a)
return!t[a].c},
$S:5}
A.cH.prototype={
$0(){return A.d([],u.t)},
$S:6}
A.cI.prototype={
$0(){return A.dc(u.S)},
$S:7}
A.cJ.prototype={
$0(){return A.dc(u.S)},
$S:7}
A.cL.prototype={
$2(a,b){var t
A.y(a)
t=u.J.a(b).w
t===$&&A.b1()
return a+t.length},
$S:18}
A.af.prototype={
aa(){return"GeometrySolveStatus."+this.b}}
A.cc.prototype={}
A.ba.prototype={
b7(a,b,c,d){var t,s=!0
if(this.a.length!==0)if(c.length!==0)if(!B.a.O(c,new A.cX())){t=this.c
if(isFinite(t))if(t>0){s=this.d
s=s.length!==c.length||B.a.O(s,new A.cY())}}if(s)throw A.b(A.l("Invalid geometric preference target."))}}
A.cX.prototype={
$1(a){return!isFinite(A.aC(a))},
$S:0}
A.cY.prototype={
$1(a){A.aC(a)
return!isFinite(a)||a<=0},
$S:0}
A.cb.prototype={}
A.a_.prototype={
aa(){return"GeometryPreferenceStatus."+this.b}}
A.cZ.prototype={}
A.aq.prototype={}
A.d3.prototype={
gbT(){var t,s,r,q,p,o,n
for(t=this.e,s=t.length,r=0,q=0;q<s;++q){p=t[q]
o=p.f
n=o==null?null:p.d-o
if(n==null)return null
r+=n}return this.a===B.k?r:null}}
A.d4.prototype={
b9(a,b){var t,s,r,q,p,o,n,m,l,k,j=this,i=A.d([],u.w)
for(t=j.a,s=t.a,r=s.length,q=0;q<r;++q)i.push(new Float64Array(A.F(s[q].b)))
j.b=u.E.a(i)
i=t.r
p=i.length
o=J.cg(p,u.S)
for(n=0;n<p;++n)o[n]=n
j.e.L(0,o)
s=A.d([],u.O)
for(r=i.length,q=0;q<i.length;i.length===r||(0,A.h)(i),++q){m=i[q]
l=m.f
k=new Float64Array(l)
s.push(new A.bR(m,t,k,new Float64Array(l)))}u.ba.a(s)
j.d!==$&&A.ew()
j.d=s},
b1(a){var t,s,r,q=this.be(B.T,B.B,null,null,null,u.r.a(a),B.L)
try{for(t=q.aB(),s=t.$ti,t=new A.aB(t.a(),s.h("aB<1>")),s=s.c;t.n();){r=t.b
if(r==null)s.a(r)}t=q.at
t.toString
return t}finally{this.x=!1}},
be(a9,b0,b1,b2,b3,b4,b5){var t,s,r,q,p,o,n,m,l,k,j,i,h,g,f,e,d,c,b,a,a0,a1,a2,a3,a4,a5,a6,a7,a8=this
u.r.a(b4)
if(a8.x)throw A.b(A.aj("This session already has an active solve."))
t=a9.c
s=a9.d
r=a9.e
q=a9.f
p=a9.r
o=a9.w
n=a9.x
if(!isFinite(t)||t<=0||!isFinite(s)||s<=0||!isFinite(r)||r<0||!isFinite(q)||q<0||!isFinite(p)||p<=0)A.V(A.l("Invalid geometric solve options."))
m=b5.b
l=b5.e
k=b5.f
j=b5.r
i=b5.w
if(m<1||!isFinite(l)||l<=0||!isFinite(k)||k<=0||!isFinite(j)||j<=0||isNaN(i)||i<=0)A.V(A.l("Invalid geometric preference options."))
h=A.d([],u.G)
for(g=b4.length,f=a8.a,e=f.c,d=f.a,c=d.length,b=0;b<b4.length;b4.length===g||(0,A.h)(b4),++b){a=b4[b]
a0=A.eK(a.d,a.a,a.b,a.c)
a1=a0.a
a2=e.j(0,a1)
if(a2!=null){if(a2>>>0!==a2||a2>=c)return A.a(d,a2)
a3=!d[a2].r.a0(new Float64Array(A.F(a0.b)))}else a3=!0
if(a3)throw A.b(A.l("Invalid preference for "+a1+"."))
B.a.k(h,new A.al(a2,a0,new Float64Array(A.F(a0.b))))}for(g=h.length,e=a8.e,a1=f.e,b=0;b<h.length;h.length===g||(0,A.h)(h),++b){a3=h[b].a
if(!(a3<c))return A.a(d,a3)
if(!d[a3].c){a3=a1.j(0,a3)
e.L(0,a3==null?B.a2:a3)}}a4=a8.r
if(a4!=null)g=!(a4.r===p&&a4.w===o&&a4.x===n)
else g=!1
if(g){a5=f.r.length
a6=J.cg(a5,u.S)
for(a7=0;a7<a5;++a7)a6[a7]=a7
e.L(0,a6)}a8.x=!0
g=a8.w
f=A.d([],u.c)
d=u.S
c=a8.b
c===$&&A.b1()
c=A.dN(c)
e=A.dd(e,d)
a1=new A.dn()
$.ez()
a3=$.dj.$0()
a1.a=a3
a1.b=null
return new A.cA(a8,new A.cc(a9.a,a9.b,t,s,r,q,p,o,n),b0,b1,b2,g,h,new A.cb(b5.a,m,b5.c,b5.d,l,k,j,i),c,e,a1,f,A.dc(d))},
sbg(a){this.c=u.v.a(a)}}
A.aA.prototype={}
A.au.prototype={
bb(a5,a6,a7,a8,a9){var t,s,r,q,p,o,n,m,l,k,j,i,h,g,f,e,d,c,b,a,a0,a1,a2,a3,a4=this
for(t=a4.b,s=t.length,r=a4.c,q=a6.a,p=q.length,o=0;o<t.length;t.length===s||(0,A.h)(t),++o){n=t[o]
r.l(0,n,a4.e)
m=a4.e
if(!(n>=0&&n<p))return A.a(q,n)
a4.e=m+q[n].r.a}t=u.t
l=A.d([0],t)
k=A.d([],t)
for(s=a8.length,m=a6.b,j=m.length,i=a4.d,o=0;o<a8.length;a8.length===s||(0,A.h)(a8),++o){h=a8[o]
if(!(h>=0&&h<a9.length))return A.a(a9,h)
g=a9[h]
f=A.d([],t)
e=A.d([],t)
d=A.d([],t)
for(c=g.length,b=0,a=0;a<g.length;g.length===c||(0,A.h)(g),++a){n=g[a]
a0=r.j(0,n)
a1=a0==null
B.a.k(e,a1?-1:f.length)
B.a.k(d,a1?-1:b)
if(!a1){if(!(n<p))return A.a(q,n)
b+=q[n].r.a
for(a2=0;a2<q[n].r.a;++a2)B.a.k(f,a0+a2)}}B.a.k(i,new A.aA(h,g,a4.f,e,d,b))
if(!(h<j))return A.a(m,h)
a3=0
for(;a3<m[h].c;++a3){B.a.L(k,f)
B.a.k(l,k.length);++a4.f}}t=new Int32Array(A.F(l))
a4.r!==$&&A.ew()
a4.r=t
t=new Int32Array(A.F(k))
a4.w!==$&&A.ew()
a4.w=t}}
A.bR.prototype={
gB(){var t,s,r,q,p,o,n,m,l,k,j,i,h,g,f,e,d,c,b,a=this,a0=a.e
if(a0===$){t=a.a
s=u.S
r=u.q
q=u.A
p=A.d([],q)
q=A.d([],q)
o=A.d([],u.w)
n=t.f
m=new Float64Array(n)
l=new Float64Array(n)
k=t.e
j=new Float64Array(k)
i=new Float64Array(k)
h=new Float64Array(k)
g=new Float64Array(n)
f=t.r
f===$&&A.b1()
e=t.w
e===$&&A.b1()
d=new Float64Array(e.length)
c=new A.dm(n,k,f,e,d)
c.ba(e,k,f,n,d)
b=new A.dL(c,m,l,j,i,h,g,A.E(s,r),A.E(s,r),A.E(s,r),p,q,o)
b.bc(t,a.b)
a.e!==$&&A.iw()
a.e=b
a0=b}return a0}}
A.dL.prototype={
bc(a3,a4){var t,s,r,q,p,o,n,m,l,k,j,i,h,g,f,e,d,c,b,a,a0,a1,a2=this
for(t=a3.b,s=t.length,r=a2.y,q=a2.x,p=a4.a,o=p.length,n=a2.w,m=0;m<t.length;t.length===s||(0,A.h)(t),++m){l=t[m]
if(!(l>=0&&l<o))return A.a(p,l)
k=p[l].r.a
n.l(0,l,new Float64Array(k*k))
q.l(0,l,new Float64Array(k))
r.l(0,l,new Float64Array(k))}for(t=a3.d,s=t.length,r=a2.as,q=a4.b,n=q.length,k=a2.Q,j=u.w,i=a2.z,m=0;m<t.length;t.length===s||(0,A.h)(t),++m){h=t[m]
g=h.a
if(!(g>=0&&g<n))return A.a(q,g)
f=q[g]
e=A.d([],j)
for(d=h.b,c=d.length,b=0;b<d.length;d.length===c||(0,A.h)(d),++b){l=d[b]
if(!(l<o))return A.a(p,l)
a=p[l]
e.push(new Float64Array(a.r.a))}B.a.k(i,e)
e=A.d([],j)
for(c=d.length,a=f.c,a0=f instanceof A.aU,b=0;b<d.length;d.length===c||(0,A.h)(d),++b){l=d[b]
if(a0){if(!(l<o))return A.a(p,l)
a1=p[l].c}else a1=!1
if(a1)a1=0
else{if(!(l<o))return A.a(p,l)
a1=p[l].r.a*a}e.push(new Float64Array(a1))}B.a.k(k,e)
g=q[g]
B.a.k(r,new Float64Array(g.c))}}}
A.dz.prototype={}
A.al.prototype={}
A.dy.prototype={}
A.cA.prototype={
v(){var t,s=this
if(s.a.w!==s.f)return s.ch=B.x
t=s.ch
if(t!=null)return t
return null},
bz(){return this.v()!=null},
aB(){return new A.am(this.b2(),u.p)},
b2(){var t=this
return function(){var s=0,r=2,q=[],p,o,n,m,l,k,j,i,h,g,f,e,d,c,b,a
return function $async$aB(a0,a1,a2){if(a1===1){q.push(a2)
s=r}for(;;)switch(s){case 0:a=t.v()
if(a!=null){t.R(a)
s=1
break}p=t.a,o=p.a.r,n=o.length,m=t.Q,l=t.b.a,k=t.y,j=p.f,i=t.as,h=t.x,g=0
case 3:if(!(g<o.length)){s=5
break}f=o[g]
e=p.d
e===$&&A.b1()
d=f.a
if(!(d<e.length)){A.a(e,d)
s=1
break}c=e[d]
a=t.v()
if(a!=null){t.R(a)
s=1
break}if(!k.an(0,d)&&j.C(d)){e=j.j(0,d)
e.toString
B.a.k(m,e)
i.k(0,d);++t.k2
s=4
break}++t.k1
s=6
return a0.ak(t.ah(c,l))
case 6:if(c.r)i.k(0,d)
if(t.ay!=null){B.a.k(m,t.a9(c,!1))
p=t.ay
p.toString
t.E(p,t.CW)
s=1
break}b=f.e===0||t.Y(c,h,!0)
a=t.v()
if(a!=null){t.R(a)
s=1
break}if(!(t.S(c,!1)<=1)){t.E(B.c,"Residual callback changed during evaluation.")
s=1
break}B.a.k(m,t.a9(c,b))
s=7
return a0.b=0,1
case 7:case 4:o.length===n||(0,A.h)(o),++g
s=3
break
case 5:s=t.r.length!==0?8:9
break
case 8:s=10
return a0.ak(t.aJ())
case 10:if(t.at!=null){s=1
break}case 9:a=t.v()
t.R(a==null?B.k:a)
case 1:return 0
case 2:return a0.c=q.at(-1),3}}}},
aJ(){return new A.am(this.bo(),u.p)},
bo(){var t=this
return function(){var s=0,r=2,q=[],p,o,n,m,l,k,j,i,h,g,f,e,d,c,b,a,a0,a1,a2,a3,a4,a5,a6,a7,a8,a9,b0,b1,b2,b3,b4,b5,b6,b7,b8,b9,c0,c1,c2,c3,c4,c5,c6,c7,c8,c9,d0,d1,d2,d3,d4,d5,d6,d7,d8,d9,e0,e1,e2,e3,e4,e5,e6,e7,e8,e9,f0,f1,f2,f3,f4,f5,f6,f7,f8,f9,g0
return function $async$aJ(g1,g2,g3){if(g2===1){q.push(g3)
s=r}for(;;)A:switch(s){case 0:for(p=t.r,o=p.length,n=t.a,m=n.a,l=m.a,k=l.length,j=t.x,i=0;i<p.length;p.length===o||(0,A.h)(p),++i){h=p[i]
g=h.a
if(!(g<k)){A.a(l,g)
s=1
break A}f=l[g]
if(!(g<j.length)){A.a(j,g)
s=1
break A}A.hX(f.r,j[g],h.c)}o=B.a.gaQ(t.ag())
t.cy=o
if(!isFinite(o)){t.E(B.c,"Preference objective is non-finite.")
s=1
break}o=m.r,m=o.length,g=t.Q,f=t.w,e=f.b,d=t.b,c=d.f,b=f.c,a=f.f,a0=f.w,a1=f.a,a2=f.e,a3=d.w,d=d.x,a4=f.d,f=f.r,a5=t.gai(),a6=u.S,a7=u.q,a8=A.C(p),a9=a8.h("o(1)"),a8=a8.h("aa<1>"),b0=a8.h("e.E"),i=0
case 3:if(!(i<o.length)){s=5
break}b1=o[i]
b2=A.ed(new A.aa(p,a9.a(new A.dD(b1)),a8),b0)
if(b2.length===0){s=4
break}b3=n.d
b3===$&&A.b1()
b4=b1.a
if(!(b4<b3.length)){A.a(b3,b4)
s=1
break}b5=b3[b4]
b4=A.E(a6,a7)
for(b3=b1.b,b6=b3.length,b7=0;b7<b3.length;b3.length===b6||(0,A.h)(b3),++b7){b8=b3[b7]
if(!(b8>=0&&b8<k)){A.a(l,b8)
s=1
break A}b9=l[b8]
b4.l(0,b8,new Float64Array(b9.r.a))}b6=b1.f
c0=new Float64Array(b6)
c1=new Float64Array(b6)
b6=b1.c,b9=b5.c,c2=b5.d,c3=!1,c4=0
case 6:if(!!c3){s=8
break}c5=t.v()
if(c5!=null){t.R(c5)
s=1
break}if(!t.Y(b5,j,!0)){p=t.v()
if(p==null)p=B.c
t.E(p,t.ax)
s=1
break}c6=t.br(b5,b2)
c7=c6.a
if(!isFinite(c7)||!isFinite(c6.c)||B.b.O(c6.d,new A.dE())){t.E(B.c,"Preference objective or derivative is non-finite.")
s=1
break}if(c6.b<=a){s=8
break}c8=b5.gB()
c9=c6.d
d0=A.is(c8.a,c9,a3,d,a4,f,a5)
c5=t.v()
if(c5!=null){t.R(c5)
s=1
break}d1=d0.a
if(d1!==B.d){t.E(d1===B.h?B.p:B.c,"The preference nullspace projection did not converge.")
s=1
break}d1=d0.b
d2=A.M(d1)
if(d2<=a2*Math.max(1,A.M(c9))){s=8
break}if(c4>=a1){t.E(B.p,"Preference iteration budget reached; hard constraints remain feasible, but this transaction was not committed.")
s=1
break}++t.db
for(c9=b3.length,b7=0;b7<b3.length;b3.length===c9||(0,A.h)(b3),++b7){b8=b3[b7]
d3=b4.j(0,b8)
d3.toString
if(!(b8>=0&&b8<j.length)){A.a(j,b8)
s=1
break A}B.b.G(d3,0,j[b8])}B.b.G(c0,0,b9)
B.b.G(c1,0,c2)
d4=new A.dG(t,b1,b4,b5,c0,c1)
d5=t.bq(b5,b2,d1)
if(!isFinite(d5)||d5<=0){t.E(B.c,"Preference directional curvature is undefined.")
s=1
break}d6=d2*d2/d5
if(d2*d6>a0)d6=a0/d2
c9=d1.length,d7=!1,d8=null,d9=0
case 9:if(!(e0=!1,d9<e)){s=11
break}d4.$0()
for(d3=b3.length,e1=-d6,e2=!0,e3=0,b7=0;b7<b3.length;b3.length===d3||(0,A.h)(b3),++b7){b8=b3[b7]
if(!(b8>=0&&b8<k)){A.a(l,b8)
s=1
break A}e4=l[b8]
e5=b6.j(0,b8)
e5.toString
e6=c8.x.j(0,b8)
for(e7=e6.length,e8=e4.f,e9=e8.length,f0=e6.$flags|0,f1=0;f1<e7;++f1){f2=e5+f1
if(!(f2<c9)){A.a(d1,f2)
s=1
break A}f2=d1[f2]
if(!(f1<e9)){A.a(e8,f1)
s=1
break A}f3=e8[f1]
f0&2&&A.m(e6)
e6[f1]=e1*f2*f3}e5=e4.r
e7=b4.j(0,b8)
e7.toString
if(!(b8<j.length)){A.a(j,b8)
s=1
break A}e5.aW(e7,e6,j[b8])
e7=e4.d
f0=e7.length
f2=e4.e
f3=f2.length
f1=0
for(;;){if(!(b8<j.length)){A.a(j,b8)
s=1
break A}f4=j[b8]
if(!(f1<f4.length))break
f5=f4[f1]
if(!(f1<f0)){A.a(e7,f1)
s=1
break A}f6=e7[f1]
if(!(f1<f3)){A.a(f2,f1)
s=1
break A}f6=B.l.al(f5,f6,f2[f1])
f4.$flags&2&&A.m(f4)
f4[f1]=f6
if(!(b8<j.length)){A.a(j,b8)
s=1
break A}f6=j[b8]
if(!(f1<f6.length)){A.a(f6,f1)
s=1
break A}f6=f6[f1]
f4=b4.j(0,b8)
if(!(f1<f4.length)){A.a(f4,f1)
s=1
break A}f4=f4[f1]
if(!(f1<e9)){A.a(e8,f1)
s=1
break A}f7=(f6-f4)/e8[f1]
e3+=f7*f7;++f1}if(!(b8<j.length)){A.a(j,b8)
s=1
break A}e2=B.r.a3(e2,e5.a0(j[b8]))}if(e2&&Math.sqrt(e3)<=c){d4.$0()
c3=!0
s=11
break}s=e2?12:14
break
case 12:++t.dy
s=15
return g1.ak(t.ah(b5,b))
case 15:c5=t.v()
if(c5!=null){d4.$0()
t.R(c5)
s=1
break}if(t.ay==null&&t.S(b5,!1)<=1){f8=t.aL(b5,b2,!1)
d3=f8.a
e1=!1
if(isFinite(d3))if(d3<c7)d3=d3<=c7-0.0001*d6*d2*d2||f8.b<=a
else d3=e1
else d3=e1
if(d3){++t.dx
if(f8.b<=a)c3=!0
e0=!0
d7=!0
s=11
break}d7=!0}else d8=t.ay
s=13
break
case 14:d8=B.c
case 13:d6*=0.5
s=16
return g1.b=0,1
case 16:case 10:++d9
s=9
break
case 11:if(!e0&&!c3){d4.$0()
if(d7)p=B.j
else p=d8==null?B.j:d8
t.E(p,"No feasible improving preference step was found; the transaction was not committed.")
s=1
break}s=17
return g1.b=0,1
case 17:case 7:++c4
s=6
break
case 8:if(!t.Y(b5,j,!0)||!(t.S(b5,!1)<=1)){p=t.v()
if(p==null)p=B.c
o=t.ax
t.E(p,o==null?"Required constraints failed final preference validation.":o)
s=1
break}f9=t.a9(b5,!0)
g0=B.a.bN(g,new A.dF(b1))
if(g0>=0)B.a.l(g,g0,f9)
else B.a.k(g,f9)
case 4:o.length===m||(0,A.h)(o),++i
s=3
break
case 5:t.cx=t.aH(t.ag()[1]<=a?B.M:B.w)
case 1:return 0
case 2:return g1.c=q.at(-1),3}}}},
aL(b3,b4,b5){var t,s,r,q,p,o,n,m,l,k,j,i,h,g,f,e,d,c,b,a,a0,a1,a2,a3,a4,a5,a6,a7,a8,a9,b0,b1,b2
u.Q.a(b4)
t=b3.a
s=t.e
r=new Float64Array(s)
q=A.E(u.S,u.i)
for(p=b4.length,o=this.x,n=this.a.a.a,m=n.length,t=t.c,l=0,k=0,j=0;j<b4.length;b4.length===p||(0,A.h)(b4),++j){i=b4[j]
h=i.a
g=i.b
if(!(h<m))return A.a(n,h)
f=n[h]
e=f.r.a
d=t.j(0,h)
d.toString
b3.gB().w.j(0,h).toString
for(c=f.f,b=c.length,a=g.c,a0=g.d,a1=a0.length,a2=o.length,a3=i.c,a4=a3.length,a5=0,a6=0,a7=0;a7<e;++a7){if(!(a7<a1))return A.a(a0,a7)
a8=a0[a7]
if(!(h<a2))return A.a(o,h)
a9=o[h]
if(!(a7<a9.length))return A.a(a9,a7)
a9=a9[a7]
if(!(a7<a4))return A.a(a3,a7)
b0=(a9-a3[a7])/a8
a5+=b0*b0
if(!b5)continue
if(!(a7<b))return A.a(c,a7)
b1=c[a7]/a8
a9=d+a7
if(!(a9<s))return A.a(r,a9)
b2=r[a9]
if(!(a9<s))return A.a(r,a9)
r[a9]=b2+a*b0*b1
a6=Math.max(a6,a*b1*b1)
b5=!0}l+=0.5*a*a5
k=Math.max(k,Math.sqrt(a5))
d=q.j(0,h)
if(d==null)d=0
q.l(0,h,d+a6)}return new A.dy(l,k,q.a===0?1:new A.X(q,q.$ti.h("X<2>")).bZ(0,B.A),r)},
br(a,b){return this.aL(a,b,!0)},
ag(){var t,s,r,q,p,o,n,m,l,k,j,i,h,g,f,e,d,c,b
for(t=this.r,s=t.length,r=this.x,q=0,p=0,o=0;o<t.length;t.length===s||(0,A.h)(t),++o){n=t[o]
for(m=n.c,l=m.length,k=n.a,j=r.length,i=n.b,h=i.d,g=h.length,f=0,e=0;e<l;++e){if(!(k<j))return A.a(r,k)
d=r[k]
if(!(e<d.length))return A.a(d,e)
d=d[e]
c=m[e]
if(!(e<g))return A.a(h,e)
b=(d-c)/h[e]
f+=b*b}q+=0.5*i.c*f
p=Math.max(p,Math.sqrt(f))}return A.d([q,p],u.n)},
bq(a5,a6,a7){var t,s,r,q,p,o,n,m,l,k,j,i,h,g,f,e,d,c,b,a,a0,a1,a2,a3,a4
u.Q.a(a6)
for(t=a6.length,s=a7.length,r=this.a.a.a,q=r.length,p=a5.a.c,o=0,n=0;n<a6.length;a6.length===t||(0,A.h)(a6),++n){m=a6[n]
l=m.a
if(!(l<q))return A.a(r,l)
k=r[l]
j=p.j(0,l)
j.toString
i=a5.gB().w.j(0,l)
for(l=k.r.a,h=m.b,g=h.d,f=g.length,h=h.c,e=i.length,d=k.f,c=d.length,b=0;b<l;++b){for(a=b*l,a0=0,a1=0;a1<l;++a1){a2=a+a1
if(!(a2<e))return A.a(i,a2)
a2=i[a2]
if(!(a1<c))return A.a(d,a1)
a3=d[a1]
a4=j+a1
if(!(a4<s))return A.a(a7,a4)
a0+=a2*a3*a7[a4]}if(!(b<f))return A.a(g,b)
a0/=g[b]
o+=h*a0*a0}}return o},
aH(a){this.ag()
this.cy.toString
return new A.cZ()},
ah(a,b){return new A.am(this.bx(a,b),u.p)},
bx(a,b){var t=this
return function(){var s=a,r=b
var q=0,p=2,o=[],n,m,l,k,j,i,h,g,f,e,d,c,a0,a1,a2,a3,a4,a5,a6,a7,a8,a9,b0,b1,b2,b3,b4,b5,b6,b7,b8,b9,c0,c1,c2,c3,c4,c5,c6,c7,c8,c9,d0,d1,d2,d3,d4,d5,d6,d7,d8,d9,e0,e1
return function $async$ah(e2,e3,e4){if(e3===1){o.push(e4)
q=p}for(;;)A:switch(q){case 0:t.CW=t.ay=null
n=s.a
m=t.x
if(!t.Y(s,m,!1)){m=t.v()
t.ay=m==null?B.c:m
t.CW=t.ax
q=1
break}q=3
return e2.b=0,1
case 3:l=t.b
k=l.c
j=A.bn(m,!0,u.q)
for(i=n.b,h=i.length,g=0;g<i.length;i.length===h||(0,A.h)(i),++g){f=i[g]
e=s.gB().y.j(0,f)
e.toString
B.a.l(j,f,e)}h=l.f
e=t.a.a.a
d=e.length
c=n.c
a0=s.d
a1=l.b
a2=l.d
a3=t.gai()
a4=u.F
l=l.e
a5=s.c
a6=2
a7=B.p
a8=0
case 4:if(!(a8<r&&!(t.S(s,!1)<=1))){q=5
break}a9=t.v()
if(a9!=null){t.ay=a9
q=1
break}if(n.e===0){a7=B.j
q=5
break}if(!t.Y(s,m,!0)){m=t.v()
t.ay=m==null?B.c:m
t.CW=t.ax
q=1
break}++t.id
b0=s.gB()
b1=b0.a
b2=b0.e
b1.P(a0,b2)
b3=b0.d
b1.aV(b3)
for(b4=0,b5=1e-12,b6=0;b7=n.e,b6<b7;++b6){if(!(b6<b2.length)){A.a(b2,b6)
q=1
break A}b4=Math.max(b4,Math.abs(b2[b6]))
if(!(b6<b3.length)){A.a(b3,b6)
q=1
break A}b5=Math.max(b5,b3[b6])}B.b.T(b3,0,b7,b5)
b8=0.5*A.a1(a0,a0)
if(!isFinite(b8)||!isFinite(b4)||B.b.O(b3,new A.dH())){a7=B.c
q=5
break}if(b4<=l){a7=B.j
q=5
break}++t.fy
a4.a(a3)
b7=b1.b
b9=(b7<=64&&(b1.a+b7)*b7<=262144?B.C:B.K).aA(b1,a0,k,b3,a1,a2,a3)
t.go=t.go+b9.c
a9=t.v()
if(a9!=null){t.ay=a9
q=1
break}b3=b9.a
q=b3!==B.d?7:8
break
case 7:if(b3===B.i){t.ay=B.U
q=1
break}k*=a6
a6*=2
a7=b3===B.h?B.p:B.c
if(!isFinite(k)||k>1e30){q=5
break}q=9
return e2.b=0,1
case 9:q=6
break
case 8:b3=b0.f
b7=b9.b
B.b.G(b3,0,b7)
for(c0=i.length,c1=b7.length,c2=!0,g=0;g<i.length;i.length===c0||(0,A.h)(i),++g){f=i[g]
if(!(f>=0&&f<d)){A.a(e,f)
q=1
break A}c3=e[f]
c4=c.j(0,f)
c4.toString
c5=b0.x.j(0,f)
for(c6=c5.length,c7=c3.f,c8=c7.length,c9=c5.$flags|0,d0=0;d0<c6;++d0){d1=c4+d0
if(!(d1<c1)){A.a(b7,d1)
q=1
break A}d1=b7[d1]
if(!(d0<c8)){A.a(c7,d0)
q=1
break A}d2=c7[d0]
c9&2&&A.m(c5)
c5[d0]=d1*d2}c6=c3.r
if(!(f<m.length)){A.a(m,f)
q=1
break A}c9=m[f]
if(!(f<j.length)){A.a(j,f)
q=1
break A}c6.aW(c9,c5,j[f])
c9=c3.d
d1=c9.length
d2=c3.e
d3=d2.length
d0=0
for(;;){if(!(f<j.length)){A.a(j,f)
q=1
break A}d4=j[f]
if(!(d0<d4.length))break
d5=d4[d0]
if(!(d0<d1)){A.a(c9,d0)
q=1
break A}d6=c9[d0]
if(!(d0<d3)){A.a(d2,d0)
q=1
break A}d6=B.l.al(d5,d6,d2[d0])
d4.$flags&2&&A.m(d4)
d4[d0]=d6
d6=c4+d0
if(!(f<j.length)){A.a(j,f)
q=1
break A}d4=j[f]
if(!(d0<d4.length)){A.a(d4,d0)
q=1
break A}d4=d4[d0]
if(!(f<m.length)){A.a(m,f)
q=1
break A}d5=m[f]
if(!(d0<d5.length)){A.a(d5,d0)
q=1
break A}d5=d5[d0]
if(!(d0<c8)){A.a(c7,d0)
q=1
break A}d7=c7[d0]
b3.$flags&2&&A.m(b3)
if(!(d6<b3.length)){A.a(b3,d6)
q=1
break A}b3[d6]=(d4-d5)/d7;++d0}if(!(f<j.length)){A.a(j,f)
q=1
break A}c2=B.r.a3(c2,c6.a0(j[f]))}if(A.M(b3)<=h){a7=B.j
q=5
break}d8=!1
if(c2&&t.aF(s,j,!1,!0)){b7=b0.c
d9=0.5*A.a1(b7,b7)
c0=b0.r
b1.U(b3,c0)
e0=-A.a1(b2,b3)-0.5*A.a1(c0,c0)
e1=e0>0?(b8-d9)/e0:-1
if(isFinite(d9))if(!(t.S(s,!0)<=1)){b1=d9<b8&&e1>0.0001
d8=b1}else d8=!0
if(d8){for(b1=i.length,g=0;g<i.length;i.length===b1||(0,A.h)(i),++g){f=i[g]
if(!(f>=0&&f<m.length)){A.a(m,f)
q=1
break A}b2=m[f]
if(!(f<j.length)){A.a(j,f)
q=1
break A}B.b.G(b2,0,j[f])}B.b.G(a5,0,b0.b)
B.b.G(a0,0,b7)
k=B.l.al(k*Math.max(0.3333333333333333,1-Math.pow(2*e1-1,3)),1e-15,1e30)
a6=2}}a9=t.v()
if(a9!=null){t.ay=a9
q=1
break}if(!d8){k*=a6
a6*=2}if(!isFinite(k)||k>1e30){a7=B.j
q=5
break}q=10
return e2.b=0,1
case 10:case 6:++a8
q=4
break
case 5:if(!(t.S(s,!1)<=1)){t.ay=a7
t.CW="Required equations remain outside tolerance; local nonconvergence does not prove infeasibility."}case 1:return 0
case 2:return e2.c=o.at(-1),3}}}},
aF(b7,b8,b9,c0){var t,s,r,q,p,o,n,m,l,k,j,i,h,g,f,e,d,c,b,a,a0,a1,a2,a3,a4,a5,a6,a7,a8,a9,b0,b1,b2,b3,b4,b5,b6=this
u.E.a(b8)
t=c0?b7.gB().b:b7.c
s=c0?b7.gB().c:b7.d
b6.ax=null
try{if(b9)for(a3=b7.a.b,a4=a3.length,a5=b6.a.a.a,a6=0;a6<a3.length;a3.length===a4||(0,A.h)(a3),++a6){r=a3[a6]
a7=B.a.j(a5,r)
a8=B.a.j(b8,r)
a9=b7.gB().w.j(0,r)
a9.toString
a7.r.bX(a8,a9)}q=0
a3=b7.a.d
a4=b6.a.a
a5=a4.a
a7=!b9
a4=a4.b
a8=a4.length
for(;;){a9=q
b0=a3.length
if(typeof a9!=="number")return a9.K()
if(!(a9<b0))break
if(b6.v()!=null)return!1
p=B.a.j(a3,q)
a9=p.a
if(!(a9>=0&&a9<a8))return A.a(a4,a9)
o=a4[a9]
a9=b7.gB()
n=B.a.j(a9.z,q)
m=B.a.j(a9.Q,q)
l=0
for(;;){b0=l
b1=J.D(n)
if(typeof b0!=="number")return b0.K()
if(!(b0<b1))break
b0=l
b1=B.a.j(p.b,l)
if(!(b1<b8.length))return A.a(b8,b1)
J.e4(n,b0,b8[b1])
if(b9)B.b.T(J.t(m,l),0,J.t(m,l).length,0)
b0=l
if(typeof b0!=="number")return b0.A()
l=b0+1}k=B.a.j(a9.as,q)
J.fL(k,0,J.D(k),0/0)
if(o instanceof A.aU){b0=o.a
b1=o.c
b2=o.r
b3=b9?m:null
b4=p.e
A.fh(b0,b1,b2,n,k,b3,p.f,b4)
if(b9)b6.k3=b6.k3+p.f}else{b0=b9?m:null
o.bJ(n,k,b0)}++b6.fr
if(b9)++b6.fx
j=0
for(;;){b0=j
b1=o.c
if(typeof b0!=="number")return b0.K()
if(!(b0<b1))break
A:{b0=p.c
b1=j
if(typeof b1!=="number")return A.aG(b1)
i=b0+b1
J.e4(t,i,J.t(k,j))
J.e4(s,i,J.t(k,j)/B.a.j(o.f,j))
if(!isFinite(J.t(s,i))){b6.ax="Non-finite residual in "+o.a+"."
return!1}if(a7)break A
h=0
for(;;){b0=h
b1=J.D(n)
if(typeof b0!=="number")return b0.K()
if(!(b0<b1))break
B:{g=B.a.j(p.b,h)
f=B.a.j(a5,g)
if(f.c)break B
b0=a9.w.j(0,g)
b0.toString
e=b0
d=f.r.a
c=f.r.a
b=0
for(;;){b0=b
b1=c
if(typeof b0!=="number")return b0.K()
if(typeof b1!=="number")return A.aG(b1)
if(!(b0<b1))break
a=0
a0=0
for(;;){b0=a0
b1=d
if(typeof b0!=="number")return b0.K()
if(typeof b1!=="number")return A.aG(b1)
if(!(b0<b1))break
b0=a
b1=J.t(m,h)
b2=j
b3=d
if(typeof b2!=="number")return b2.t()
if(typeof b3!=="number")return A.aG(b3)
b4=a0
if(typeof b4!=="number")return A.aG(b4)
b4=b2*b3+b4
if(b4>>>0!==b4||b4>=b1.length)return A.a(b1,b4)
b4=b1[b4]
b1=a0
b3=c
if(typeof b1!=="number")return b1.t()
if(typeof b3!=="number")return A.aG(b3)
b2=b
if(typeof b2!=="number")return A.aG(b2)
b2=J.t(e,b1*b3+b2)
if(typeof b0!=="number")return b0.A()
a=b0+b4*b2
b0=a0
if(typeof b0!=="number")return b0.A()
a0=b0+1}b0=a
b1=B.a.j(f.f,b)
if(typeof b0!=="number")return b0.t()
a1=b0*b1/B.a.j(o.f,j)
if(!isFinite(a1)){b6.ax="Non-finite Jacobian in "+o.a+"."
return!1}b0=a9.a
b1=B.a_.j(b0.c,i)
b2=B.a.j(p.d,h)
b3=b
if(typeof b3!=="number")return A.aG(b3)
B.b.l(b0.e,b1+b2+b3,a1)
b0=b
if(typeof b0!=="number")return b0.A()
b=b0+1}}b0=h
if(typeof b0!=="number")return b0.A()
h=b0+1}}b0=j
if(typeof b0!=="number")return b0.A()
j=b0+1}a9=q
if(typeof a9!=="number")return a9.A()
q=a9+1}if(!c0)b7.r=!0
return!0}catch(b5){a2=A.ex(b5)
b6.ax="Residual evaluation failed: "+A.j(a2)
return!1}},
Y(a,b,c){return this.aF(a,b,c,!1)},
S(a,b){var t,s,r,q,p,o,n,m,l,k,j,i,h,g,f,e,d=b?a.gB().b:a.c
for(t=a.a.d,s=t.length,r=d.length,q=this.a.a.b,p=q.length,o=0,n=0;n<s;++n){m=t[n]
l=m.a
if(!(l>=0&&l<p))return A.a(q,l)
k=q[l]
for(l=k.c,j=m.c,i=k.e,h=i.length,g=0;g<l;++g){f=j+g
if(!(f<r))return A.a(d,f)
f=d[f]
if(!(g<h))return A.a(i,g)
e=Math.abs(f)/i[g]
if(!isFinite(e))return 1/0
o=Math.max(o,e)}}return o},
bn(a){return this.S(a,!1)},
a9(a9,b0){var t,s,r,q,p,o,n,m,l,k,j,i,h,g,f,e,d,c,b,a,a0,a1,a2=this,a3=a9.a,a4=A.d([],u.s),a5=a3.e,a6=a2.b,a7=a6.w,a8=a5<=a7&&a3.f*a5<=a6.x
if(!a8)a9.f=null
if(a5===0||a3.f===0)t=0
else if(b0&&a8){s=a9.f
if(s!=null){a5=a9.gB()
a5=s.b===a6.r&&s.c===a7&&s.d===a6.x&&A.i_(s.a,a5.a.e)}else a5=!1
if(a5){t=s.e
B.a.L(a4,s.f);++a2.ok}else{a5=a9.gB().a
r=a5.c0();++a2.k4
q=a6.r
p=a2.gai()
o=A.fq(r,a3.f,a3.e,q,p)
t=o==null?null:o.a
n=t!=null
if(n&&a3.f>t){m=r.length
l=new Float64Array(m)
for(k=a3.f,j=a3.e,i=0;i<k;++i)for(h=i*j,g=0;g<j;++g){f=g*k+i
e=h+g
if(!(e<m))return A.a(r,e)
e=r[e]
if(!(f<m))return A.a(l,f)
l[f]=e}++a2.k4
d=A.fq(l,a3.e,a3.f,q,p)
n=d!=null&&d.a===t
if(n){p=d.b
c=A.dd(p,A.C(p).c)
for(p=a3.d,m=p.length,k=a2.a.a.b,j=k.length,b=0;b<p.length;p.length===m||(0,A.h)(p),++b){a=p[b]
h=a.a
if(!(h>=0&&h<j))return A.a(k,h)
a0=k[h]
for(h=a0.c,f=a.c,a1=!0,i=0;i<h;++i)a1=B.r.a3(a1,!c.an(0,f+i))
if(a1)B.a.k(a4,a0.a)}}}if(n){t.toString
a9.f=new A.dz(new Float64Array(A.F(a5.e)),q,a7,a6.x,t,A.z(a4,u.N))}}}else t=null
a5=u.N
A.z(J.fP(a3.b,new A.dB(a2),u.z),a5)
a6=a3.d
a7=A.C(a6)
A.z(new A.a7(a6,a7.h("@(1)").a(new A.dC(a2)),a7.h("a7<1,@>")),a5)
a7=a3.e
A.z(a4,a5)
a2.bn(a9)
return new A.aq(a3.a,a7,t)},
E(a7,a8){var t,s,r,q,p,o,n,m,l,k,j,i,h,g,f,e,d,c,b,a,a0,a1,a2,a3,a4=this,a5=a4.a,a6=a4.f
if(a5.w!==a6)a7=B.x
t=a4.z
if(t.b==null)t.b=$.dj.$0()
if(a4.cy!=null)s=a4.cx==null||a7!==B.k
else s=!1
if(s){switch(a7.a){case 0:s=B.w
break
case 1:s=B.O
break
case 2:s=B.P
break
case 3:s=B.Q
break
case 4:s=B.N
break
case 5:s=B.R
break
case 6:s=B.S
break
default:s=null}a4.cx=a4.aH(s)}s=u.N
r=u.o
q=A.E(s,r)
for(p=a5.a,o=p.r,n=o.length,m=p.b,l=m.length,k=u.i,j=a4.as,i=0;i<o.length;o.length===n||(0,A.h)(o),++i){h=o[i]
g=h.a
if(!j.an(0,g))continue
f=a5.d
f===$&&A.b1()
if(!(g<f.length))return A.a(f,g)
e=f[g]
for(g=h.d,f=g.length,d=e.c,c=d.length,b=0;b<g.length;g.length===f||(0,A.h)(g),++b){a=g[b]
a0=a.a
if(!(a0>=0&&a0<l))return A.a(m,a0)
a1=m[a0]
a0=a.c
a2=A.bn(new Float64Array(d.subarray(a0,A.hB(a0,a0+a1.c,c))),!1,k)
a2.$flags=3
q.l(0,a1.a,a2)}}o=a4.x
n=A.i1(p,o)
A.eG(q,s,r)
r=a4.Q
s=A.z(r,u.M)
p.gbR()
A.fZ(t.gbG())
a4.at=new A.d3(a7,n,s)
if(a5.w!==a6)return
if(a7===B.k){a5.sbg(A.dN(o))
a5.b=u.E.a(A.dN(o))
a5.e.c_(a4.y)
a5.r=a4.b
for(a6=r.length,a5=a5.f,i=0;i<r.length;r.length===a6||(0,A.h)(r),++i){a3=r[i]
a5.l(0,a3.a,a3)}}else{a6=a5.c
if(a6!=null){a5.b=u.E.a(A.dN(a6))
a5.e.L(0,a4.y)}}},
R(a){return this.E(a,null)}}
A.dD.prototype={
$1(a){return this.a.c.C(u.bd.a(a).a)},
$S:20}
A.dE.prototype={
$1(a){return!isFinite(a)},
$S:0}
A.dG.prototype={
$0(){var t,s,r,q,p,o,n,m,l=this
for(t=l.b.b,s=t.length,r=l.a.x,q=l.c,p=0;p<t.length;t.length===s||(0,A.h)(t),++p){o=t[p]
if(!(o>=0&&o<r.length))return A.a(r,o)
n=r[o]
m=q.j(0,o)
m.toString
B.b.G(n,0,m)}t=l.d
B.b.G(t.c,0,l.e)
B.b.G(t.d,0,l.f)},
$S:21}
A.dF.prototype={
$1(a){return u.M.a(a).a===this.a.a},
$S:22}
A.dH.prototype={
$1(a){return!isFinite(a)},
$S:0}
A.dB.prototype={
$1(a){var t
A.y(a)
t=this.a.a.a.a
if(!(a>=0&&a<t.length))return A.a(t,a)
return t[a].a},
$S:23}
A.dC.prototype={
$1(a){var t=this.a.a.a.b,s=u.ak.a(a).a
if(!(s>=0&&s<t.length))return A.a(t,s)
return t[s].a},
$S:24}
A.e1.prototype={
$1(a){var t=this.a,s=t.length
if(!(a>=0&&a<s))return A.a(t,a)
return new A.b9(t[a],t[B.f.b0(a+1,s)])},
$S:25}
A.dY.prototype={
$1(a){return A.iu(A.aD(a))},
$S:26};(function aliases(){var t=J.ag.prototype
t.b3=t.i
t=A.u.prototype
t.b4=t.az})();(function installTearOffs(){var t=hunkHelpers._static_0,s=hunkHelpers._static_1,r=hunkHelpers._instance_0u,q=hunkHelpers.installStaticTearOff
t(A,"hW","h6",2)
s(A,"i8","hC",3)
r(A.cA.prototype,"gai","bz",19)
q(A,"ir",2,null,["$1$2","$2"],["fu",function(a,b){return A.fu(a,b,u.H)}],27,0)})();(function inheritance(){var t=hunkHelpers.mixin,s=hunkHelpers.inherit,r=hunkHelpers.inheritMany
s(A.q,null)
r(A.q,[A.ea,J.ce,A.bw,J.ap,A.p,A.dl,A.e,A.as,A.bE,A.W,A.ay,A.aR,A.b3,A.bF,A.ai,A.H,A.dq,A.dg,A.Q,A.da,A.bl,A.bm,A.Z,A.cw,A.dI,A.aB,A.cz,A.aw,A.u,A.bQ,A.c0,A.c2,A.dw,A.c4,A.dt,A.ck,A.bx,A.c7,A.bt,A.dn,A.aT,A.v,A.dm,A.K,A.c3,A.cp,A.bW,A.d_,A.ar,A.bK,A.at,A.bc,A.d2,A.b9,A.bb,A.cN,A.c9,A.ca,A.bd,A.cV,A.cD,A.cc,A.ba,A.cb,A.cZ,A.aq,A.d3,A.d4,A.aA,A.au,A.bR,A.dL,A.dz,A.al,A.dy,A.cA])
r(J.ce,[J.bf,J.bh,J.bj,J.aN,J.aP,J.bi,J.aM])
r(J.bj,[J.ag,J.i,A.aS,A.bs])
r(J.ag,[J.cl,J.bB,J.a4])
s(J.cf,A.bw)
s(J.d6,J.i)
r(J.bi,[J.bg,J.ch])
r(A.p,[A.aQ,A.bA,A.ci,A.ct,A.co,A.cv,A.bk,A.bX,A.a2,A.bD,A.cs,A.by,A.c1])
r(A.e,[A.b8,A.aa,A.am])
r(A.b8,[A.Y,A.O,A.X])
r(A.Y,[A.bz,A.a7,A.cy])
s(A.aV,A.ay)
s(A.az,A.aV)
s(A.aX,A.aR)
s(A.bC,A.aX)
s(A.b4,A.bC)
s(A.b6,A.b3)
r(A.ai,[A.b5,A.bL])
s(A.b7,A.b5)
r(A.H,[A.cd,A.bZ,A.c_,A.cr,A.dU,A.dW,A.e_,A.e0,A.dQ,A.cP,A.cQ,A.cT,A.cR,A.cS,A.cO,A.cU,A.cW,A.d0,A.d1,A.ds,A.cK,A.cE,A.cG,A.cX,A.cY,A.dD,A.dE,A.dF,A.dH,A.dB,A.dC,A.e1,A.dY])
s(A.aL,A.cd)
r(A.bZ,[A.dh,A.cF,A.cH,A.cI,A.cJ,A.dG])
s(A.bu,A.bA)
r(A.cr,[A.cq,A.aK])
r(A.Q,[A.a5,A.cx])
r(A.c_,[A.dV,A.db,A.df,A.dx,A.dP,A.dO,A.cL])
s(A.a0,A.bs)
r(A.a0,[A.bG,A.bI])
s(A.bH,A.bG)
s(A.bq,A.bH)
s(A.bJ,A.bI)
s(A.br,A.bJ)
s(A.bo,A.bq)
s(A.bp,A.br)
s(A.aW,A.cv)
s(A.av,A.bL)
s(A.cj,A.bk)
s(A.d7,A.c0)
r(A.c2,[A.d9,A.d8])
s(A.dv,A.dw)
r(A.a2,[A.bv,A.be])
r(A.dt,[A.ae,A.af,A.a_])
s(A.c6,A.c9)
s(A.aU,A.bd)
t(A.bG,A.u)
t(A.bH,A.W)
t(A.bI,A.u)
t(A.bJ,A.W)
t(A.aX,A.bQ)})()
var v={G:typeof self!="undefined"?self:globalThis,typeUniverse:{eC:new Map(),tR:{},eT:{},tPV:{},sEA:[]},mangledGlobalNames:{c:"int",k:"double",ac:"num",n:"String",o:"bool",bt:"Null",f:"List",q:"Object",P:"Map",N:"JSObject"},mangledNames:{},types:["o(k)","f<v>(f<f<v>>)","c()","@(@)","~(q?,q?)","o(c)","f<c>()","ah<c>()","@(@,n)","@(n)","~(@,@)","ar(A,c,ae[c?])","~(c)","bK({cancelled:o,finite:o,iterationLimit:o})","k(c,c)","~(f<A>,A,f<A>?)","c(c,A)","c(c)","c(c,au)","o()","o(al)","~()","o(aq)","n(c)","n(aA)","b9(c)","n(n)","0^(0^,0^)<ac>"],interceptorsByTag:null,leafTags:null,arrayRti:Symbol("$ti"),rttc:{"3;":(a,b,c)=>d=>d instanceof A.az&&a.b(d.a)&&b.b(d.b)&&c.b(d.c)}}
A.hr(v.typeUniverse,JSON.parse('{"a4":"ag","cl":"ag","bB":"ag","iB":"aS","bf":{"o":[],"I":[]},"bh":{"I":[]},"bj":{"N":[]},"ag":{"N":[]},"i":{"f":["1"],"N":[],"e":["1"]},"cf":{"bw":[]},"d6":{"i":["1"],"f":["1"],"N":[],"e":["1"]},"ap":{"L":["1"]},"bi":{"k":[],"ac":[]},"bg":{"k":[],"c":[],"ac":[],"I":[]},"ch":{"k":[],"ac":[],"I":[]},"aM":{"n":[],"I":[]},"aQ":{"p":[]},"b8":{"e":["1"]},"Y":{"e":["1"]},"bz":{"Y":["1"],"e":["1"],"Y.E":"1","e.E":"1"},"as":{"L":["1"]},"a7":{"Y":["2"],"e":["2"],"Y.E":"2","e.E":"2"},"aa":{"e":["1"],"e.E":"1"},"bE":{"L":["1"]},"az":{"aV":[],"ay":[]},"b4":{"bC":["1","2"],"aX":["1","2"],"aR":["1","2"],"bQ":["1","2"],"P":["1","2"]},"b3":{"P":["1","2"]},"b6":{"b3":["1","2"],"P":["1","2"]},"bF":{"L":["1"]},"b5":{"ai":["1"],"ah":["1"],"e":["1"]},"b7":{"b5":["1"],"ai":["1"],"ah":["1"],"e":["1"]},"cd":{"H":[],"a3":[]},"aL":{"H":[],"a3":[]},"bu":{"p":[]},"ci":{"p":[]},"ct":{"p":[]},"H":{"a3":[]},"bZ":{"H":[],"a3":[]},"c_":{"H":[],"a3":[]},"cr":{"H":[],"a3":[]},"cq":{"H":[],"a3":[]},"aK":{"H":[],"a3":[]},"co":{"p":[]},"a5":{"Q":["1","2"],"eP":["1","2"],"P":["1","2"],"Q.K":"1","Q.V":"2"},"O":{"e":["1"],"e.E":"1"},"bl":{"L":["1"]},"X":{"e":["1"],"e.E":"1"},"bm":{"L":["1"]},"aV":{"ay":[]},"aS":{"N":[],"I":[]},"bs":{"N":[]},"a0":{"aO":["1"],"N":[]},"bq":{"u":["k"],"a0":["k"],"f":["k"],"aO":["k"],"N":[],"e":["k"],"W":["k"]},"br":{"u":["c"],"a0":["c"],"f":["c"],"aO":["c"],"N":[],"e":["c"],"W":["c"]},"bo":{"A":[],"u":["k"],"a0":["k"],"f":["k"],"aO":["k"],"N":[],"e":["k"],"W":["k"],"I":[],"u.E":"k","W.E":"k"},"bp":{"e8":[],"u":["c"],"a0":["c"],"f":["c"],"aO":["c"],"N":[],"e":["c"],"W":["c"],"I":[],"u.E":"c","W.E":"c"},"cv":{"p":[]},"aW":{"p":[]},"aB":{"L":["1"]},"am":{"e":["1"],"e.E":"1"},"av":{"ai":["1"],"ah":["1"],"e":["1"]},"aw":{"L":["1"]},"Q":{"P":["1","2"]},"aR":{"P":["1","2"]},"bC":{"aX":["1","2"],"aR":["1","2"],"bQ":["1","2"],"P":["1","2"]},"ai":{"ah":["1"],"e":["1"]},"bL":{"ai":["1"],"ah":["1"],"e":["1"]},"cx":{"Q":["n","@"],"P":["n","@"],"Q.K":"n","Q.V":"@"},"cy":{"Y":["n"],"e":["n"],"Y.E":"n","e.E":"n"},"bk":{"p":[]},"cj":{"p":[]},"k":{"ac":[]},"c":{"ac":[]},"f":{"e":["1"]},"ah":{"e":["1"]},"bX":{"p":[]},"bA":{"p":[]},"a2":{"p":[]},"bv":{"p":[]},"be":{"p":[]},"bD":{"p":[]},"cs":{"p":[]},"by":{"p":[]},"c1":{"p":[]},"ck":{"p":[]},"bx":{"p":[]},"aT":{"ha":[]},"c3":{"c8":[]},"cp":{"c8":[]},"bW":{"c8":[]},"c6":{"c9":[]},"aU":{"bd":[]},"e8":{"f":["c"],"e":["c"]},"A":{"f":["k"],"e":["k"]}}'))
A.hq(v.typeUniverse,JSON.parse('{"b8":1,"a0":1,"bL":1,"c0":2,"c2":2}'))
var u=(function rtii(){var t=A.bT
return{C:t("p"),q:t("A"),Z:t("a3"),M:t("aq"),_:t("ca"),x:t("bd"),r:t("e<ba>"),l:t("e<k>"),U:t("e<@>"),Y:t("e<c>"),W:t("i<v>"),w:t("i<A>"),c:t("i<aq>"),u:t("i<ba>"),k:t("i<bc>"),h:t("i<f<v>>"),A:t("i<f<A>>"),B:t("i<f<k>>"),D:t("i<f<c>>"),s:t("i<n>"),e:t("i<au>"),G:t("i<al>"),d:t("i<aA>"),O:t("i<bR>"),n:t("i<k>"),b:t("i<@>"),t:t("i<c>"),T:t("bh"),m:t("N"),L:t("a4"),da:t("aO<@>"),ab:t("f<v>(f<f<v>>)"),E:t("f<A>"),V:t("f<f<v>>"),a:t("f<n>"),Q:t("f<al>"),ba:t("f<bR>"),o:t("f<k>"),j:t("f<@>"),aH:t("f<c>"),cg:t("P<n,@>"),f:t("P<@,@>"),P:t("bt"),K:t("q"),cY:t("iC"),cD:t("+()"),bz:t("ah<c>"),N:t("n"),R:t("I"),cr:t("bB"),bS:t("aa<c>"),J:t("au"),bd:t("al"),ak:t("aA"),p:t("am<c>"),y:t("o"),aU:t("o(c)"),i:t("k"),z:t("@"),S:t("c"),bc:t("eJ<bt>?"),aQ:t("N?"),v:t("f<A>?"),aL:t("f<@>?"),cO:t("P<n,@>?"),X:t("q?"),aD:t("n?"),g:t("cz?"),cG:t("o?"),F:t("o()?"),I:t("k?"),a3:t("c?"),ae:t("ac?"),H:t("ac"),cQ:t("~(n,@)")}})();(function constants(){var t=hunkHelpers.makeConstList
B.V=J.ce.prototype
B.a=J.i.prototype
B.r=J.bf.prototype
B.f=J.bg.prototype
B.l=J.bi.prototype
B.m=J.aM.prototype
B.W=J.a4.prototype
B.X=J.bj.prototype
B.b=A.bo.prototype
B.a_=A.bp.prototype
B.z=J.cl.prototype
B.t=J.bB.prototype
B.A=new A.aL(A.ir(),A.bT("aL<k>"))
B.B=new A.bW()
B.C=new A.c3()
B.u=function getTagFallback(o) {
  var s = Object.prototype.toString.call(o);
  return s.substring(8, s.length - 1);
}
B.D=function() {
  var toStringFunction = Object.prototype.toString;
  function getTag(o) {
    var s = toStringFunction.call(o);
    return s.substring(8, s.length - 1);
  }
  function getUnknownTag(object, tag) {
    if (/^HTML[A-Z].*Element$/.test(tag)) {
      var name = toStringFunction.call(object);
      if (name == "[object Object]") return null;
      return "HTMLElement";
    }
  }
  function getUnknownTagGenericBrowser(object, tag) {
    if (object instanceof HTMLElement) return "HTMLElement";
    return getUnknownTag(object, tag);
  }
  function prototypeForTag(tag) {
    if (typeof window == "undefined") return null;
    if (typeof window[tag] == "undefined") return null;
    var constructor = window[tag];
    if (typeof constructor != "function") return null;
    return constructor.prototype;
  }
  function discriminator(tag) { return null; }
  var isBrowser = typeof HTMLElement == "function";
  return {
    getTag: getTag,
    getUnknownTag: isBrowser ? getUnknownTagGenericBrowser : getUnknownTag,
    prototypeForTag: prototypeForTag,
    discriminator: discriminator };
}
B.I=function(getTagFallback) {
  return function(hooks) {
    if (typeof navigator != "object") return hooks;
    var userAgent = navigator.userAgent;
    if (typeof userAgent != "string") return hooks;
    if (userAgent.indexOf("DumpRenderTree") >= 0) return hooks;
    if (userAgent.indexOf("Chrome") >= 0) {
      function confirm(p) {
        return typeof window == "object" && window[p] && window[p].name == p;
      }
      if (confirm("Window") && confirm("HTMLElement")) return hooks;
    }
    hooks.getTag = getTagFallback;
  };
}
B.E=function(hooks) {
  if (typeof dartExperimentalFixupGetTag != "function") return hooks;
  hooks.getTag = dartExperimentalFixupGetTag(hooks.getTag);
}
B.H=function(hooks) {
  if (typeof navigator != "object") return hooks;
  var userAgent = navigator.userAgent;
  if (typeof userAgent != "string") return hooks;
  if (userAgent.indexOf("Firefox") == -1) return hooks;
  var getTag = hooks.getTag;
  var quickMap = {
    "BeforeUnloadEvent": "Event",
    "DataTransfer": "Clipboard",
    "GeoGeolocation": "Geolocation",
    "Location": "!Location",
    "WorkerMessageEvent": "MessageEvent",
    "XMLDocument": "!Document"};
  function getTagFirefox(o) {
    var tag = getTag(o);
    return quickMap[tag] || tag;
  }
  hooks.getTag = getTagFirefox;
}
B.G=function(hooks) {
  if (typeof navigator != "object") return hooks;
  var userAgent = navigator.userAgent;
  if (typeof userAgent != "string") return hooks;
  if (userAgent.indexOf("Trident/") == -1) return hooks;
  var getTag = hooks.getTag;
  var quickMap = {
    "BeforeUnloadEvent": "Event",
    "DataTransfer": "Clipboard",
    "HTMLDDElement": "HTMLElement",
    "HTMLDTElement": "HTMLElement",
    "HTMLPhraseElement": "HTMLElement",
    "Position": "Geoposition"
  };
  function getTagIE(o) {
    var tag = getTag(o);
    var newTag = quickMap[tag];
    if (newTag) return newTag;
    if (tag == "Object") {
      if (window.DataView && (o instanceof window.DataView)) return "DataView";
    }
    return tag;
  }
  function prototypeForTagIE(tag) {
    var constructor = window[tag];
    if (constructor == null) return null;
    return constructor.prototype;
  }
  hooks.getTag = getTagIE;
  hooks.prototypeForTag = prototypeForTagIE;
}
B.F=function(hooks) {
  var getTag = hooks.getTag;
  var prototypeForTag = hooks.prototypeForTag;
  function getTagFixed(o) {
    var tag = getTag(o);
    if (tag == "Document") {
      if (!!o.xmlVersion) return "!Document";
      return "!HTMLDocument";
    }
    return tag;
  }
  function prototypeForTagFixed(tag) {
    if (tag == "Document") return null;
    return prototypeForTag(tag);
  }
  hooks.getTag = getTagFixed;
  hooks.prototypeForTag = prototypeForTagFixed;
}
B.v=function(hooks) { return hooks; }

B.n=new A.d7()
B.J=new A.ck()
B.o=new A.dl()
B.K=new A.cp()
B.q=new A.c7("")
B.d=new A.ae(0,"converged")
B.h=new A.ae(1,"iterationLimit")
B.i=new A.ae(2,"cancelled")
B.e=new A.ae(3,"numericalFailure")
B.L=new A.cb(64,16,30,1000,1e-8,1e-7,1e-10,1/0)
B.M=new A.a_(0,"targetReached")
B.w=new A.a_(1,"stationary")
B.N=new A.a_(2,"noProgress")
B.O=new A.a_(3,"iterationLimit")
B.P=new A.a_(4,"cancelled")
B.Q=new A.a_(5,"deadlineExceeded")
B.R=new A.a_(6,"numericalFailure")
B.S=new A.a_(7,"staleRevision")
B.T=new A.cc(100,1000,0.001,1e-8,1e-14,1e-14,1e-10,96,262144)
B.k=new A.af(0,"satisfied")
B.p=new A.af(1,"iterationLimit")
B.U=new A.af(2,"cancelled")
B.j=new A.af(4,"stalled")
B.c=new A.af(5,"numericalFailure")
B.x=new A.af(6,"staleRevision")
B.Y=new A.d8(null)
B.Z=new A.d9(null)
B.ab=t([],u.u)
B.y=t([],u.t)
B.a1=new A.az(0,0,0)
B.a0={}
B.a2=new A.b7(B.a0,0,A.bT("b7<c>"))
B.a3=A.e2("iy")
B.a4=A.e2("A")
B.a5=A.e2("e8")
B.a6=A.e2("q")
B.a7=new A.at(0,0,0)
B.a8=new A.at(0,0,1)
B.a9=new A.at(0,1,0)
B.aa=new A.at(1,0,0)})();(function staticFields(){$.du=null
$.R=A.d([],A.bT("i<q>"))
$.eS=null
$.di=0
$.dj=A.hW()
$.eD=null
$.eC=null
$.fs=null
$.fo=null
$.fx=null
$.dS=null
$.dX=null
$.et=null
$.dA=A.d([],A.bT("i<f<q>?>"))})();(function lazyInitializers(){var t=hunkHelpers.lazyFinal
t($,"iA","fz",()=>A.fr("_$dart_dartClosure"))
t($,"iz","ey",()=>A.fr("_$dart_dartClosure_dartJSInterop"))
t($,"iQ","fK",()=>A.d([new J.cf()],A.bT("i<bw>")))
t($,"iE","fA",()=>A.a9(A.dr({
toString:function(){return"$receiver$"}})))
t($,"iF","fB",()=>A.a9(A.dr({$method$:null,
toString:function(){return"$receiver$"}})))
t($,"iG","fC",()=>A.a9(A.dr(null)))
t($,"iH","fD",()=>A.a9(function(){var $argumentsExpr$="$arguments$"
try{null.$method$($argumentsExpr$)}catch(s){return s.message}}()))
t($,"iK","fG",()=>A.a9(A.dr(void 0)))
t($,"iL","fH",()=>A.a9(function(){var $argumentsExpr$="$arguments$"
try{(void 0).$method$($argumentsExpr$)}catch(s){return s.message}}()))
t($,"iJ","fF",()=>A.a9(A.eW(null)))
t($,"iI","fE",()=>A.a9(function(){try{null.$method$}catch(s){return s.message}}()))
t($,"iN","fJ",()=>A.a9(A.eW(void 0)))
t($,"iM","fI",()=>A.a9(function(){try{(void 0).$method$}catch(s){return s.message}}()))
t($,"iP","e3",()=>A.fv(B.a6))
t($,"iD","ez",()=>{A.h7()
return $.di})
t($,"iO","ad",()=>A.h5(0))})();(function nativeSupport(){!function(){var t=function(a){var n={}
n[a]=1
return Object.keys(hunkHelpers.convertToFastObject(n))[0]}
v.getIsolateTag=function(a){return t("___dart_"+a+v.isolateTag)}
var s="___dart_isolate_tags_"
var r=Object[s]||(Object[s]=Object.create(null))
var q="_ZxYxX"
for(var p=0;;p++){var o=t(q+"_"+p+"_")
if(!(o in r)){r[o]=1
v.isolateTag=o
break}}v.dispatchPropertyName=v.getIsolateTag("dispatch_record")}()
hunkHelpers.setOrUpdateInterceptorsByTag({ArrayBuffer:A.aS,SharedArrayBuffer:A.aS,ArrayBufferView:A.bs,Float64Array:A.bo,Int32Array:A.bp})
hunkHelpers.setOrUpdateLeafTags({ArrayBuffer:true,SharedArrayBuffer:true,ArrayBufferView:false,Float64Array:true,Int32Array:true})
A.a0.$nativeSuperclassTag="ArrayBufferView"
A.bG.$nativeSuperclassTag="ArrayBufferView"
A.bH.$nativeSuperclassTag="ArrayBufferView"
A.bq.$nativeSuperclassTag="ArrayBufferView"
A.bI.$nativeSuperclassTag="ArrayBufferView"
A.bJ.$nativeSuperclassTag="ArrayBufferView"
A.br.$nativeSuperclassTag="ArrayBufferView"})()
Function.prototype.$1=function(a){return this(a)}
Function.prototype.$2=function(a,b){return this(a,b)}
Function.prototype.$0=function(){return this()}
Function.prototype.$3=function(a,b,c){return this(a,b,c)}
Function.prototype.$4=function(a,b,c,d){return this(a,b,c,d)}
Function.prototype.$1$1=function(a){return this(a)}
convertAllToFastObject(w)
convertToFastObject($);(function(a){if(typeof document==="undefined"){a(null)
return}if(typeof document.currentScript!="undefined"){a(document.currentScript)
return}var t=document.scripts
function onLoad(b){for(var r=0;r<t.length;++r){t[r].removeEventListener("load",onLoad,false)}a(b.target)}for(var s=0;s<t.length;++s){t[s].addEventListener("load",onLoad,false)}})(function(a){v.currentScript=a
var t=A.ip
if(typeof dartMainRunner==="function"){dartMainRunner(t,[])}else{t([])}})})()