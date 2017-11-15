 //视口主要负责呈现，事件的识别和分发
class Panorama{
    constructor($container,config){
         this.$container=$container;
         this.scene=null;
         this.renderer=null;
         this.camera=null;

         this.R=400;//热点、标注等图标距离球心的半径
         
         //状态位，根据状态位判断鼠标事件，以及事件发生在哪个对象上，好进行事件分发。
        /*系统需要的事件有单击事件，拖动事件，鼠标滑动事件
         这几个事件的判断是在distinguishEvent()方法里的。
         在refreshFrame()方法里根据这几个状态位判断相应事件，做事件响应*/
         //************************************************************************ 
         this.mouseUp=false;
         this.mouseDown=false;
        
         this.mouseMove=false;
         this.mouseDrag=false;
         this.mouseClick=false;
         
         this.event=null;//原始的事件
         this.mouse = new THREE.Vector2();//记录鼠标事件发生时鼠标的位置

         this.raycaster = new THREE.Raycaster();
         this.INTERSECTED=null;//设置鼠标滑过某个对象时的效果，此变量用来缓存鼠标滑动到的对象。

         //供实现拖拽旋转效果使用的参数
         //this.lon = 0;
         //this.lat = 0;
         this.mouseCoordinateWhenMouseDown=new THREE.Vector2();//鼠标按下时的坐标
         //*************************************************************************

         /**场景中使用的全局变量 */
         //************************************************************* */
         this.imageTextures=new Map();//图片纹理,存储加载的图片资源，像箭头之类的。
         this.sphereMesh=null;//球体网格
         this.fontOptions=null;//字体加载后生成的字体选项      
         this.panoramaTextures=new Map();//资源池，存放全景图生成的全景纹理
         //************************************************************* */
  
         //***************需要配合使用的外部插件************************* */
         this.compass=null;

         /**异步启动系统 */
         //********************************************************* */
         this.loadFont();//先加载字体资源，再图片资源，再加载全景资源，然后启动系统。
         //********************************************************* */
    }


     /**加载字体，加载完成后再执行之后的程序 */
    loadFont(){
        this.messageBoxShow('加载字体,9.92M,请耐心等待');
        var loader=new THREE.FontLoader();//新建字体对象
        var fontJsonUrl=config.resource.font;
        loader.load( fontJsonUrl, (response)=> {//字体加载成功后再进行后续操作。
            this.fontOptions= {
                size: 8, //字号大小，一般为大写字母的高度
                height: 1, //文字的厚度
                weight: 'normal', //值为'normal'或'bold'，表示是否加粗
                font: response, //字体,加载成功后返回的response即为font对象
                style: 'normal', //值为'normal'或'italics'，表示是否斜体
                bevelThickness: 1, //倒角厚度
                bevelSize: 1, //倒角宽度
                curveSegments: 12,//弧线分段数，使得文字的曲线更加光滑
                bevelEnabled: true, //布尔值，是否使用倒角，意为在边缘处斜切
            };
            this.loadResourceSynchronously();//同步方式加载图片资源，箭头图片等，而不是全景图片。
        });
    }



     /**加载图片资源，即config.resource.image里的资源，资源的加载是异步的，但是会等到所有资源都加载完才启动系统。*/
    loadResourceSynchronously(){
       this.messageBoxShow('加载系统资源');
       var indicators=new Map();//指示器中以资源名为索引存放着各个资源是否加载完成的布尔。
       $.each(config.resource.image,(i,value)=>{
          if(value.name && value.name!=""){
            indicators.put(value.name,false);
          }        
       });//设置指示器,将每个资源释放加载完成设置为false
        $.each(config.resource.image,(i,value)=>{//开始设置异步加载各个资源。
            if(value && value!=""){
                var textureLoader=new THREE.TextureLoader();
                textureLoader.load(value.url,(texture)=>{//资源加载完成后
                    this.imageTextures.put(value.name,texture);//缓存资源
                    indicators.put(value.name,true);//指示器中该资源是否加载完成设置为true.
                    
                    var isAllResouceLoaded=true;//假设所有的资源都加载完成了
                    /**遍历指示器，如果有任何一个资源没有加载完成，则全局指示器isAllResouceLoaded设置为false。
                     * 这样当遍历完指示器后，如果isAllResouceLoaded为false,那么说明还有资源没有加载完成，
                     * 则本资源加载工作结束，启动系统的任务留给最后一个加载完的资源。
                     * 最后一个资源加载完成时，它判断的的isAllResouceLoaded结果true.
                     * 此时，由该资源加载完成的回调函数负责系统的启动工作。
                     */
                    $.each(indicators.values(),(indexOfFlag,valueOfFlag)=>{
                        if(!valueOfFlag){
                            isAllResouceLoaded=valueOfFlag;
                        }
                    });

                    if(isAllResouceLoaded){//如果所有的资源都加载了，则加载第一个场景的全景图
                        //单独加载是为了独占网络，迅速完成第一个场景全景图片的加载。之后会同时启动对其他场景图的加载。
                        this.loadFirstPanoramaTexture();                       
                    }

                });  
            }          
        }); 
    }

    /**加载第一个场景的全景图纹理 */
   loadFirstPanoramaTexture(){
       var textureLoader=new THREE.TextureLoader();
       $.each(config.scenes.list,(i,value)=>{
           if(value.name==config.scenes.default.name){
              textureLoader.load(value.image,(texture)=>{
                this.panoramaTextures.put(value.name,texture);
                textureLoader=null;
                this.preLoadPanoramaTexture();
                this.initSystem();
              });
              return false;
           }
       });
   }

     /**预加载全景纹理图片，异步。*/
    preLoadPanoramaTexture(){
        $.each(config.scenes.list,(i,v)=>{
            if(!this.panoramaTextures.containsKey(v.name)){//如果此场景尚未被加载，则加载
             var textureLoader=new THREE.TextureLoader();
             textureLoader.load(v.image,(texture)=>{
                 
                    this.panoramaTextures.put(v.name,texture);
                 
                 textureLoader=null;   
             });
            }
        });
    }

    /**启动系统 */
    initSystem(){
        this.messageBoxShow("系统初始化中");
        this.init3d();//初始化三维对象
        this.distinguishEvent();//分发事件
        this.loadDefaultPanoramaScene();//加载默认场景
        
    }
    

    /*****************以下为init3d()相关代码*************/

    /**初始化系统使用的3d对象 */
    init3d() {
        this.initRenderer();
        this.initCamera();
        this.initScene();
        this.render();
    }
    initRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            antialias: true
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearColor(new THREE.Color('lightgrey'), 1);
        this.renderer.setSize(this.$container.innerWidth(), this.$container.innerHeight());
        this.$container.append(this.renderer.domElement);
    }
    initCamera() {
        this.camera = new THREE.PerspectiveCamera(75, this.$container.innerWidth() / this.$container.innerHeight(), 1, 1100);
        this.camera.target = new THREE.Vector3(0, 0, 0);

    }
    initScene() {
        this.scene = new THREE.Scene();
    }
    render() {
        window.requestAnimationFrame(() => { this.render() });//告诉浏览器下一次重绘之前，调用此render方法
        this.refreshFrame();
    }
    refreshFrame(){//每一帧渲染前需要做的工作，识别事件,一些事件放在这里处理是考虑频率问题，比如鼠标移动事件，其频率过高，如果再原生事件响应中做，太耗资源，容易卡。
        
                ////以下为处理鼠标事件
                if(this.mouseClick){//处理鼠标单击事件
                   // console.log("mouseClick");
                
                    this.raycaster.setFromCamera(this.mouse, this.camera);
                    var intersects = this.raycaster.intersectObjects(this.sphereMesh.children);
                    var intersected = null;
                    //console.log("this.Panorama:x:"+this.sphereMesh.position.x+"y:"+this.sphereMesh.position.y+"z:"+this.sphereMesh.position.z);
                    if (intersects.length > 0) {
                        intersected = intersects[0].object;//获取被单击的对象
            
                        if (intersected.name && intersected.name!="") {//单击该对象后的处理
                            this.loadPanoramaScene(intersected.name);
                        }
                        //console.log("bingo");
                    }
               
                    this.mouseClick = false;//复位标志位
                }
                  
                if(this.mouseMove){//处理鼠标滑过某个物体的事件
                   // console.log("mouseMove");
                    this.raycaster.setFromCamera(this.mouse, this.camera);  
                    var intersects = this.raycaster.intersectObjects(this.sphereMesh.children);  
                         if (intersects.length > 0) {//如果有命中 
                            //if(!intersects[0].object.isHotspotIconObject){//如果命中的不是热点的图标对象（即箭头），则返回，不需要响应。
                              //  return;
                            //} 
                                    if (this.INTERSECTED != intersects[0].object) {//缓存的对象与当前对象不相等，则说明鼠标移动到新的对象上了 
                                                if (this.INTERSECTED){//如果缓存的对象存在，说明鼠标从一个对象直接移动到了新的对象上，恢复缓存对象状态为鼠标未放置在其上时的状态
                                                    //恢复缓存对象为未被鼠标放置时的状态
                                                    this.INTERSECTED.scale.set(this.INTERSECTED.scaleX,this.INTERSECTED.scaleY,this.INTERSECTED.scaleZ);
                                                    this.INTERSECTED.material.opacity=this.INTERSECTED.materialOpacity;
                                                }
                                                //将当前刚刚被鼠标放置山的对象进行缓存   
                                                this.INTERSECTED = intersects[0].object; //缓存当前对象 
                                                this.INTERSECTED.scaleX = this.INTERSECTED.scale.x;//缓存当前对象的参数 
                                                this.INTERSECTED.scaleY = this.INTERSECTED.scale.y;//缓存当前对象的参数
                                                this.INTERSECTED.scaleZ = this.INTERSECTED.scale.z;//缓存当前对象的参数
                                                this.INTERSECTED.materialOpacity=this.INTERSECTED.material.opacity;//缓存当前对象的参数
        
                                                //设置对象为 鼠标覆盖时的状态 
                                                this.INTERSECTED.scale.set(1.1,1.1,1.1);
                                                this.INTERSECTED.material.opacity=1;  
                                    } //else{} 如果缓存对象和本次命中对象一致，说明鼠标还在对象上，尚未移开，此时没有动作。
                         }else { //如果没有命中 
                             if (this.INTERSECTED){//如果本次没有命中，但是有缓存（上次命中），说明鼠标从对象上滑开，则需要把对象恢复成原始的状态
                                //console.log("mouseLeave");
                                 //恢复鼠标为原始状态
                                this.INTERSECTED.scale.set(this.INTERSECTED.scaleX,this.INTERSECTED.scaleY,this.INTERSECTED.scaleZ);
                                      this.INTERSECTED.material.opacity=this.INTERSECTED.materialOpacity;
                             }  //如果鼠标上一次有命中，则把上一次命中恢复成初始状态
                             this.INTERSECTED = null;  //清空缓存
                          
                }
                this.mouseMove=false;
            }
        
                if(this.mouseDrag){//处理鼠标拖拽事件     

                    this.sphereMesh.rotation.y+= (this.mouseCoordinateWhenMouseDown.x - this.event.clientX)*0.1*Math.PI/720;
                    var roY=this.sphereMesh.rotation.y;
                    if(this.compass!=null){
                        this.compass.rotate(roY*180/Math.PI);
                    }
                    this.sphereMesh.rotation.x+=(this.event.clientY - this.mouseCoordinateWhenMouseDown.y)*0.1*Math.PI/720;
                    if(this.sphereMesh.rotation.x>(80/180*Math.PI)){
                        this.sphereMesh.rotation.x=80/180*Math.PI;
                    }
                    if(this.sphereMesh.rotation.x<-(80/180*Math.PI)){
                        this.sphereMesh.rotation.x=-(80/180*Math.PI);
                    }
                    //不会自旋转
                    //this.mouseCoordinateWhenMouseDown.x=this.event.clientX;
                    //this.mouseCoordinateWhenMouseDown.y=this.event.clientY;
                }
                
                //自动旋转
                //if(this.sphereMesh){
                   // this.sphereMesh.rotation.y+=Math.PI/360;
                //}
                
                this.renderer.render(this.scene, this.camera);
                 
            }
    /**********************以上为init3d()相关代码**************************/

    /**********************以下为加载场景相关的代码************************/
    /**加载默认场景 */
    loadDefaultPanoramaScene(){//根据配置加载场景，配置是一个场景的配置
        this.loadPanoramaScene(config.scenes.default.name);
    }

    /**加载场景 */
    loadPanoramaScene(panoramaSceneName){
        if(!panoramaSceneName){
            return;
        }
        this.messageBoxShow("加载场景:"+panoramaSceneName);
        var sceneConfig=this.getSceneConfigBySceneName(panoramaSceneName);//获取当前场景的配置
        if(this.panoramaTextures.containsKey(panoramaSceneName)){//如果已经缓存了该全景纹理，直接加载
            var  texture=this.panoramaTextures.get(panoramaSceneName);
            this.afterLoadPanoramaTexture(sceneConfig,texture);//处理全景图加载完成后的工作。
            this.messageBoxClose();//关闭信息显示
        }else{//如果该纹理没有被缓存过，则需要进行加载。
              
                var textureLoader=new THREE.TextureLoader();
              
                textureLoader.load(sceneConfig.image,(texture)=>{//纹理异步加载，加载完成后再做处理。
                if(!this.panoramaTextures.containsKey(sceneConfig.name)){
                    this.panoramaTextures.put(sceneConfig.name,texture);//加入到全景纹理缓存池里
                }//再一次做判断是因为后台开启了多任务下载。
                textureLoader=null;//释放资源
                this.afterLoadPanoramaTexture(sceneConfig,texture);//处理全景图加载完成后的工作。 
                this.messageBoxClose();//关闭信息显示      
            });
        }                    
    }

     /**根据场景名称获取场景配置 */
     getSceneConfigBySceneName(sceneName){
        var sceneConfig=null;
        $.each(config.scenes.list,(i,value)=>{
            if(value.name==sceneName){
                sceneConfig=value;
                return false;
            }
        });
        return sceneConfig;
    }


    /**加载场景时，全景图加载完成后需要做的工作 */
    afterLoadPanoramaTexture(sceneConfig,texture){
        if (!this.sphereMesh) {//如果主球体不存在，就创建
            var material = new THREE.MeshBasicMaterial({
                map: texture,
                overdraw: false
            });

            var geometry = new THREE.SphereGeometry(500, 60, 40);
            geometry.applyMatrix(new THREE.Matrix4().makeScale(-1, 1, 1));

            this.sphereMesh = new THREE.Mesh(geometry, material);
            
            this.scene.add(this.sphereMesh);
        } else {//如果主球体存在，就更换为新的全景纹理。
            this.sphereMesh.material.map = texture;
        }

        //进入场景后的初始角度，如果在场景配置中设置了则使用，如果没设置，则使用总的默认配置。
        this.sphereMesh.rotation.y=sceneConfig.view.hlookat?sceneConfig.view.hlookat/180*Math.PI:config.scenes.default.view.hlookat/180*Math.PI;
        this.sphereMesh.rotation.x=sceneConfig.view.vlookat?sceneConfig.view.vlookat/180*Math.PI:config.scenes.default.view.vlookat/180*Math.PI;

        
        this.cleanOldHotspotsAndMarks();//清理旧场景的热点和标注
        this.createNewHotspots(sceneConfig.hotspots);//创建新场景的热点对象
        this.createNewMarks(sceneConfig.marks);//创建新场景的标注对象
        this.setAutoPlayNextPanoramaScene(sceneConfig.name);//设置自动播放下一个场景。
    }
    /**清理旧的热点和标注 */
    cleanOldHotspotsAndMarks(){
        this.sphereMesh.children.splice(0,this.sphereMesh.children.length);
    }

    /**创建新的热点 */
    createNewHotspots(config_scene_hotSpots) {
        if (!config_scene_hotSpots) { //没有配置就不更新
            return;
        }

        for (var index = 0; index < config_scene_hotSpots.length; index++) {
            
            //角度值,如果该热点配置的有垂直角度和水平角度，则使用，如果没有，则使用配置的默认值。
            var angleV=config_scene_hotSpots[index].atv?config_scene_hotSpots[index].atv:config.scenes.default.hotspots.atv;//垂直角度
            var angleH=config_scene_hotSpots[index].ath?config_scene_hotSpots[index].ath:config.scenes.default.hotspots.ath;//水平角度
         
            var position=this.getObjectPositionFromAngleHAndAngleV(angleH,angleV);
            var rotationXY=this.getObjectRotationFromAngleHAndangleV(angleH,angleV);

             var hotspot =this.createHotspot(null,config_scene_hotSpots[index].name);//
             hotspot.position.x = position.x;
             hotspot.position.y = position.y;
             hotspot.position.z = position.z;
             hotspot.rotation.y = rotationXY.y;
             hotspot.rotation.x = rotationXY.x;//设置旋转。

             //this.hotSpots[index] = hotspot;

            if (this.sphereMesh) {
                this.sphereMesh.add(hotspot);
            }
          
        }
    }

    /**根据角度值计算对象的XYZ坐标*/
    getObjectPositionFromAngleHAndAngleV(angleH,angleV){
        //角度值转为弧度值
        var radianV=angleV/180*Math.PI;
        var radianH=angleH/180*Math.PI;

        //var R = 400; //热点所在球面与球心的距离
        var y=this.R*Math.sin(radianV);//atv范围是[-π/2,π/2]
        var x=this.R*Math.cos(radianV)*Math.cos(radianH);//ath范围是[0,2π]
        var z=-this.R*Math.cos(radianV)*Math.sin(radianH);

        var position=new THREE.Vector3(x,y,z);
       
        return position;
    }
    /**根据角度值计算对象以XY轴所做的旋转角度,旋转的目的是使对象朝向球心位置*/
    getObjectRotationFromAngleHAndangleV(angleH,angleV){
        var rotationAngle=0;
        rotationAngle=angleH-90;//经过计算，不管对象处于什么位置，其选择角度公式均一致。
        //注意，此处需要改成弧度值。
        //var rotationXY=new THREE.Vector2(angleV/180*Math.PI,rotationAngle/180*Math.PI);//注意，此处需要改成弧度值。
        var rotationXY=new THREE.Vector2(0,rotationAngle/180*Math.PI);//注意，此处需要改成弧度值。
        
        return rotationXY;
    }
    
    /**创建一个热点图标对象*/
    createHotspot(imageName,name){         
       var hotspot= this.createImageMeshHasTextMesh(imageName,name);
       hotspot.name=name;
       //hotspot.isHotspotIconObject=true;//设立一个标志位，判断是热点时，鼠标滑过变大，其他的物体鼠标滑过不变。
       return hotspot;
    }

    /**创建新的标注*/
    createNewMarks(config_scene_marks){
        if (!config_scene_marks) { //没有配置就不更新
            return;
        }

        for (var index = 0; index < config_scene_marks.length; index++) {
            

            //角度值
            var angleV=config_scene_marks[index].atv;//垂直角度
            var angleH=config_scene_marks[index].ath;//水平角度
         
            var position=this.getObjectPositionFromAngleHAndAngleV(angleH,angleV);
            var rotationXY=this.getObjectRotationFromAngleHAndangleV(angleH,angleV);
            var textMarkObject =this.createTextMesh(config_scene_marks[index].text);//
            textMarkObject.position.x = position.x;
            textMarkObject.position.y = position.y;
            textMarkObject.position.z = position.z;

            textMarkObject.rotation.y = rotationXY.y;
            textMarkObject.rotation.x = rotationXY.x;//设置旋转。

            
            //this.marks.push(textMarkObject);
            if (this.sphereMesh) {
                this.sphereMesh.add(textMarkObject);
            }
            
        }
    }

    /**创建一个文字网格对象*/
    createTextMesh(text){
        if(!this.fontOptions){
            return;
        }

        var textGeo = new THREE.TextGeometry(text, this.fontOptions);
        textGeo.computeBoundingBox();
        textGeo.computeVertexNormals();
                
        var material = new THREE.MultiMaterial([
                new THREE.MeshBasicMaterial( { color: 0x000000 } ), // front
                new THREE.MeshBasicMaterial( { color: 0xffffff } ) // side
            ]);
        //新建mesh,加入
        var  textMesh = new THREE.Mesh( textGeo, material );

        return textMesh;
    }

    /**创建一个图片网格*/
    createImageMesh(imageName){      
        if(!imageName){
            imageName="direct";//如果没有指定所使用的图片，则使用名为direct的图片
        }
        var plane_geometry = new THREE.PlaneGeometry(64, 64, 1, 1);
        if(this.imageTextures && this.imageTextures.containsKey(imageName)){
            var texture=this.imageTextures.get(imageName);//hotspot默认使用名为direct
            var plane_material = new THREE.MeshBasicMaterial({
                side: THREE.DoubleSide,
                map: texture,
                transparent: true,
                opacity: 1,
                overdraw: false
            });
            return new THREE.Mesh(plane_geometry, plane_material);
        }else{
            console.error(imageName+"图片不存在");
            return null;
        }
    }

    /**创建一个图片网格和文本网格的混合体*/
    createImageMeshHasTextMesh(imageName,text){
            var imageMesh=this.createImageMesh(imageName);
            var textMesh=this.createTextMesh(text);
            textMesh.position.x =-0.5*(textMesh.geometry.boundingBox.max.x-textMesh.geometry.boundingBox.min.x);
            textMesh.position.y =0;//value.position.y+hotspotTextObject.geometry.boundingBox.max.y;//textGeo.boundingBox.max.y;
            textMesh.position.z =10;
            imageMesh.add(textMesh);
            return imageMesh;   
    }

/************************以上为加载场景相关的代码*************************/


/**设置自动播放下一个场景*/
setAutoPlayNextPanoramaScene(currentSceneName){
    if(config.autoPlay.default.use){//如果开启了自动播放
        var nextIndex=this.findNextSceneIndexFromAutoPlayQueueBySceneName(currentSceneName);
        if(nextIndex==null){
            return;
        }
        console.log(nextIndex);
        window.setTimeout(()=>{//设置自动跳转，如果场景单独设置了延迟时间，则使用，否则使用总的默认延迟时间
            this.loadPanoramaScene(config.autoPlay.queue[nextIndex].name);
        },config.autoPlay.queue[nextIndex].timeOut?config.autoPlay.queue[nextIndex].timeOut:config.autoPlay.default.timeOut);
    }
}

/**根据当前场景名从播放队列中找到下一个要跳转的场景的名称。*/
findNextSceneIndexFromAutoPlayQueueBySceneName(sceneName){
    var nextSceneIndex=null;
    $.each(config.autoPlay.queue,(indexOfQueue,valueOfQueue)=>{
        if(valueOfQueue.name==sceneName){//找到当前场景中播放序列中的位置
            indexOfQueue++;//下一个场景的序号
            nextSceneIndex=indexOfQueue%config.autoPlay.queue.length;//取模运算，自动循环
            //nextSceneIndex=indexOfQueue;
            return false;
          }
    });

    return nextSceneIndex;
}

/*** 注销*/
dispose() {
    if (this.sphereMesh) {
        this.scene.remove(this.sphereMesh);
        this.sphereMesh = null;
    }
}

  
    /**********************事件分发******************/
    //先判断事件，然后在每帧渲染前针对事件做设置，然后渲染。
    //通过mouseDown,mouseUp,mouseMove组合出mouseClick,mouseDrag,mouseHover事件，
    //mouseClick事件被组合是因为有了mouseDown,mouseUp事件后，原生的mouseClick事件监听不到。
    distinguishEvent(){//绑定原生的事件监听并识别事件，原生事件中可以判断出mouseDrag事件和mouseMove事件和mouseClick事件
        this.$container.on("mouseup",event=>{
              this.mouseDown=false;
              this.mouseDrag=false;//鼠标弹起时，拖动也停止。
              if(event.originalEvent.layerX==this.mouseCoordinateWhenMouseDown.x && event.originalEvent.layerY==this.mouseCoordinateWhenMouseDown.y){
                   //如果弹起时的鼠标位置和按下时的鼠标位置一样，说明是一次单击;
                   this.mouseClick=true;
                    //保存鼠标弹起时，鼠标的位置
                    if (event.offsetX && event.offsetY) {
                        this.mouse.x = (event.offsetX / this.$container.innerWidth()) * 2 - 1;
                        this.mouse.y = -(event.offsetY / this.$container.innerHeight()) * 2 + 1;
                    } else {
                        this.mouse.x = (event.originalEvent.layerX / this.$container.innerWidth()) * 2 - 1;
                        this.mouse.y = -(event.originalEvent.layerY / this.$container.innerHeight()) * 2 + 1;
                    }
              }
              //保存原生事件
              this.event=event;
        })
        .on("mousedown",event=>{
               this.mouseDown=true;

               //获取鼠标按下时的坐标，处理拖拽事件时要用。
               this.mouseCoordinateWhenMouseDown.x=event.originalEvent.layerX;
               this.mouseCoordinateWhenMouseDown.y=event.originalEvent.layerY;
               this.event=event;

               //记录鼠标按下时的经纬，供拖拽使用。
               //this.onPointerDownLon = this.lon;
               //this.onPointerDownLat = this.lat;
        })
        .on("mousemove",event=>{
             if(this.mouseDown){//此时是拖拽状态
                 this.mouseDrag=true;
             }else{//此时只是一般的鼠标移动，但是要判断mouseHover
                 this.mouseMove=true;//如果是鼠标移动，则要处理鼠标移动到某个物体上时的响应事件,即mouseHover，这个还需要在refreshFrame（）中做进一步处理
  
                 //存储下鼠标位置,refreshFrame（）中需要根据鼠标位置发射射线判断鼠标是否在某个对象上。
                      if (event.offsetX && event.offsetY) {
                      this.mouse.x = (event.offsetX / this.$container.innerWidth()) * 2 - 1;
                      this.mouse.y = -(event.offsetY / this.$container.innerHeight()) * 2 + 1;
                      } else {
                          this.mouse.x = (event.originalEvent.layerX / this.$container.innerWidth()) * 2 - 1;
                          this.mouse.y = -(event.originalEvent.layerY / this.$container.innerHeight()) * 2 + 1;
                      }
             }
             this.event=event;
        })
        .on("mousewheel",event=>{
           
            if (event.originalEvent.wheelDeltaY) {
                this.camera.fov -=event.originalEvent.wheelDeltaY * 0.05;
            }
            // Opera / Explorer 9
            else if (event.originalEvent.wheelDelta) {
                this.camera.fov -= event.originalEvent.wheelDelta * 0.05;
            }
            // Firefox
            else if (event.originalEvent.detail) {
                this.camera.fov += event.originalEvent.detail * 1.0;
            }

            if (this.camera.fov > 80) {
                this.camera.fov = 80;
            } else if (this.camera.fov < 10) {
                this.camera.fov = 10;
            }

            this.camera.updateProjectionMatrix();
          
        })
        .on("DOMMouseScroll",event=>{//firefox响应这个事件
            if (event.originalEvent.wheelDeltaY) {
                this.camera.fov -=event.originalEvent.wheelDeltaY * 0.05;
            }
            // Opera / Explorer 9
            else if (event.originalEvent.wheelDelta) {
                this.camera.fov -= event.originalEvent.wheelDelta * 0.05;
            }
            // Firefox
            else if (event.originalEvent.detail) {
                this.camera.fov += event.originalEvent.detail * 1.0;
            }

            if (this.camera.fov > 80) {
                this.camera.fov = 80;
            } else if (this.camera.fov < 10) {
                this.camera.fov = 10;
            }

            this.camera.updateProjectionMatrix();
        })
        .on("resize",event=>{//视口大小改变,在原生事件中响应
            var width=this.$container.Width();
            var height=this.$container.Height();
            this.camera.aspect = width/height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        })
    }

    /*********************以下是系统消息功能*****************/
    //显示消息，提示系统状态，如加载字体，加载资源等    
    messageBoxShow(message){
        $.messager.progress({
            
            msg:message,
            timeout:0,
            showType:'fade',
            style:{
                right:'',
                bottom:''
            }
        });
    }
    messageBoxClose(){
        $.messager.progress('close');
    }
    /******************以上是系统消息功能 */

}

