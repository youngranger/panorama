class Geomap{//区别于编程语言中的map
    constructor($container,mapConfig,panorama){
           this.panorama=panorama;  
           this.mapConfig=mapConfig;//只获取关于全部地图的配置信息
           this.$container=$container;
           this.$geomap=$("<div id='geomap'></div>");//用来显示地图的div
           this.$container.append(this.$geomap);//把地图外包放置到容器中
           this.hotspotsOfMap=new Map();//当前地图上的热点数组
           this.highLightHotspot=null;//代表当前场景的高亮的热点,是一个jquery对象
           this.currentMapName=null;//当前地图的名称
           this.currentMapConfig=null;
           this.isShowing=false;//地图是否被显示，默认是false
    }

    highLight($hotspot){//根据场景名高亮显示某个热点
        this.highLightHotspot.attr("src","Geomap/Image/yellow.png")//把上一个高亮的热点恢复
        $hotspot.attr("src","Geomap/Image/red.png");//高亮单击的点
        this.highLightHotspot=$hotspot;
    }
    
    whenPanoramLoadScene(sceneNameThatHotspotRepresnt){
        var mapConfig=this.findMapConfigBySceneName(sceneNameThatHotspotRepresnt);//根据要加载的场景的名，找到该场景所在的地图的配置
        this.currentMapConfig=mapConfig;
        if(mapConfig.name!=this.currentMapName){//如果这个配置和当前使用的地图的配置不同，则表示换地图了。
            this.hotspotsOfMap=new Map();//清空存储着热点对象的数组，热点对象是jquery对象。
            this.$geomap.empty();//清空地图，主要是清空地图上的热点
            this.$geomap.css('background-image','url('+mapConfig.image+')');//修改地图底图
            this.$geomap.css({"width":mapConfig.size.width+"px","height":mapConfig.size.height+"px"});//设置地图组件的宽高
            $.each(mapConfig.hotspots,(i,v)=>{//加载新的热点
                var $hotspot;
                if(v.name==sceneNameThatHotspotRepresnt){//如果这个点是代表当前场景的点
                    $hotspot=$('<img src="Geomap/Image/red.png"></img>');//创建高亮形式的一个jquery对象
                    this.highLightHotspot=$hotspot;
                }else{
                    $hotspot=$('<img src="Geomap/Image/yellow.png"></img>');//创建非高亮形式的一个jquery对象
                }
                $hotspot.css({"position":"absolute","top":v.y,"left":v.x,"width":"10px","height":"10px"});//设置初始状态为隐藏
                $hotspot.click(()=>{//为这个点绑定单击事件
                        if(this.panorama){
                            this.panorama.loadPanoramaScene(v.name);//告诉全景换场景，剩下的关于地图的工作，还是由地图组件完成。
                        };
                        this.highLight($hotspot);//高亮显示
                });
        
                this.hotspotsOfMap.put(v.name,$hotspot);//存入数组
                this.$geomap.append($hotspot);//存入DOM
                this.$geomap.hide();
            });

            this.currentMapName=mapConfig.name;
        }else{//如果地图没有更改，仅仅是切换了同在一个地图上的场景
            this.highLight(this.hotspotsOfMap.get(sceneNameThatHotspotRepresnt));
        }
        //高亮热点
    }

    findMapConfigBySceneName(sceneName){//根据场景名找到它所在的地图的配置
        var mapConfig;
       $.each(this.mapConfig.list,(i,v)=>{
           $.each(v.hotspots,(iOfHotspots,vOfHotspots)=>{
               if(vOfHotspots.name==sceneName){
                 mapConfig=v;
                 return false;
               }
           })

           if(mapConfig){
               return false;
           }
       });

       return mapConfig;
    }

    show(){
        if(this.currentMapConfig){
            this.$geomap.window({
                title:"地图",
                modal:false,
                inline:false,
                collapsible:false,
                minimizable:false,
                maximizable:false,
                closable:false,
                shadow:false,
                onOpen:()=>{this.$geomap.css({"width":this.currentMapConfig.size.width+"px","height":this.currentMapConfig.size.height+"px"});}
            });  
        }  
    }

    close(){
       this.$geomap.window('close');
    }

    autoShowOrClose(){
        if(this.isShowing){
            this.close();
        }else{
            this.show();
        }

        this.isShowing=!this.isShowing;
    }
}