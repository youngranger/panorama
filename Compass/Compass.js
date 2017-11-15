class Compass{
    constructor($container){

        this.$shell=$("<div class='compass_size compass_shell compass_positon'></div>");
        $($container).append(this.$shell);

        this.$degree=$("<div  class='compass_size compass_degree'></div>");
        this.$shell.append(this.$degree);

        this.$point=$("<div  class='compass_size compass_point'></div>");
        this.$degree.append(this.$point);
    }

    rotate(degree){
       this.$point.rotate(degree);
    }
}