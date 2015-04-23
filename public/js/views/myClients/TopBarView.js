define([
    'text!templates/myProfile/TopBarTemplate.html',
    'custom',
    "common"
],
    function (TopBarTemplate, Custom, Common) {
        var TopBarView = Backbone.View.extend({
            el:'#top-bar',
            contentType: "My Clients",
            actionType: null, //Content, Edit, Create
            template: _.template(TopBarTemplate),
            
            events:{

            },

            initialize: function(options){
                this.actionType = options.actionType;
                this.render();
            },

            render: function(){
                $('title').text(this.contentType);
                this.$el.html(this.template({contentType: this.contentType}));
                Common.displayControlBtnsByActionType(this.actionType);

                return this;
            }
        });

        return TopBarView;
    });
