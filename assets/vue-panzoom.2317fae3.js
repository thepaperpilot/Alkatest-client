import{p as r}from"./panzoom.971985ef.js";import"./vue.16af0ac0.js";import{aE as c,_ as m,a8 as u,aK as p}from"./@vue.8948d9b0.js";var a={name:"panZoom",props:{options:Object,selector:String},data:function(){return{panZoomInstance:null,panZoomInstanceId:null,instanceId:null,defaultOptions:{autocenter:!0,bounds:!0,transformOrigin:{x:.5,y:.5}}}},created:function(){this.instanceId=this.generateRandomId(20)},mounted:function(){if(this.scene){var n=Object.assign({},this.defaultOptions,this.options);this.panZoomInstance=this.$panZoom(this.scene,n),this.panZoomInstanceId=this.instanceId,this.attachEvents()}},computed:{scene:function(){var n,e=this.$el.querySelector(".vue-pan-zoom-scene");return this.selector?n=e.querySelector(this.selector):(n=e.querySelector("svg, object, embed"),n||(n=e.firstChild)),n}},methods:{generateRandomId:function(n){n=n||16;for(var e="0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",o=e.length,s=[],i=0;i<n;i++)s.push(e.charAt(Math.floor(Math.random()*o)));return s.join("")},attachEvents:function(){var n=this;this.$emit("init",this.panZoomInstance,this.panZoomInstanceId),this.panZoomInstance.on("panstart",function(e){n.$emit("panstart",e)}),this.panZoomInstance.on("panend",function(e){n.$emit("panend",e)}),this.panZoomInstance.on("pan",function(e){n.$emit("pan",e)}),this.panZoomInstance.on("zoom",function(e){n.$emit("zoom",e)}),this.panZoomInstance.on("transform",function(e){n.$emit("transform",e)}),this.panZoomInstance.on("zoomend",function(e){n.$emit("zoomend",e)})},isPaused:function(){return this.panZoomInstance.isPaused()},pause:function(){this.panZoomInstance.pause()},resume:function(){this.panZoomInstance.resume()}}},d={class:"vue-pan-zoom-scene"};function h(t,n,e,o,s,i){return c(),m("div",{class:["vue-pan-zoom-item",["vue-pan-zoom-item-"+this.instanceId]]},[u("div",d,[p(t.$slots,"default")])],2)}a.render=h;a.__file="src/components/pan-zoom/component.vue";var f={install:function(n,e){var o=e&&e.componentName?e.componentName:a.name;n.component(o,a),n.hasOwnProperty("config")&&n.config.hasOwnProperty("globalProperties")?n.config.globalProperties.$panZoom=r:n.prototype.$panZoom=r}};typeof window!="undefined"&&window.Vue&&window.Vue.use(f);export{f as P};