/** Backbone Models/Collections **/
var FeedEntry = Backbone.Model.extend({
    title: "",
    author: "",
    content: "",
    contentSnippet: "",
    link: "",
    categories: [],
    mediaGroups: [],
    publishedDate: "",
    thumbnailUrl: "",
    category: "",
    videoUrl: "",
    index: 0
});
var PaginationEntry = Backbone.Model.extend({
    pageIndex: 0,
    content: []
})
var FeedContent = Backbone.Collection.extend({
    model: FeedEntry
});
var PaginationEntries = Backbone.Collection.extend({
    model: PaginationEntry
});

/** functions **/

//this function loads the main TED feed based on input parameters

function initializeFeeds(index) {
    var feed = new google.feeds.Feed("http://feeds.feedburner.com/TEDTalks_video");
    //default to fetch 25 entries
    if (!App.TotalEntries) {
        App.TotalEntries = 25;
    }
    feed.setNumEntries(App.TotalEntries);
    feed.setResultFormat(google.feeds.Feed.JSON_FORMAT);
    feed.includeHistoricalEntries();
    feed.load(function (result) {
        if (!result.error) {
            var container = document.getElementById("feed");
            var count = 1;
            App.FeedEntries.reset();
            //this is a bit of a hack since Backbone seems to not like to add objects to indices that don't exist
            //So have to artifically add so that pagination starts at 1 (easier to work with)
            App.FeedEntries.add({});
            //default to show 5 entries per page 
            if (!App.NumEntriesPerPage) {
                App.NumEntriesPerPage = 5;
            }

            //Loop over feeds and add to backbone collection
            for (var i = 0; i < result.feed.entries.length; i = i + App.NumEntriesPerPage) {
                App.FeedEntries.add(new PaginationEntry({
                    "pageIndex": count,
                    "content": []
                }), {
                    at: count
                });
                for (var j = 0; j < App.NumEntriesPerPage; j++) {
                    App.FeedEntries.at(count).get("content").push(result.feed.entries[i + j]);
                }
                count++;
            }
            //reset the pagination view
            App.PaginationView = new PaginationView({
                model: App.FeedEntries
            });
            //by default, load the bucket of the index thats passed in
            renderFeedEntries(index);
        }
    });
}

//this function determines what feeds to load on refresh

function refreshFeeds(index) {
    App.CurrentPage = parseInt(index);
    google.setOnLoadCallback(initializeFeeds(index));
}

//this function enables/disables correct pages in the pagination

function togglePagination() {
    if (App.CurrentPage) {
        //reset pagination
        $('.pagination li').removeClass("active").removeClass("disabled");
        $('.pagination').find(".page" + App.CurrentPage).addClass("active");
        if (App.CurrentPage === 1) {
            $('.prev').addClass("disabled");
        } else if (App.CurrentPage === (App.TotalEntries / App.NumEntriesPerPage)) {
            $('.next').addClass("disabled");
        }
    }
}

//this function adds the appropiate feed entries into the backbone collection
//index is the index of the bucket in App.FeedEntries of which to add from

function renderFeedEntries(index) {
    //reset the collection 
    App.FeedContent.reset();
    var entrySet = App.FeedEntries.at(index).get("content");
    for (var i = 0; i < App.NumEntriesPerPage; i++) {
        var feedEntryJson = entrySet[i];
        var feedEntryModel = new FeedEntry(feedEntryJson);
        var mediaContents = feedEntryJson.mediaGroups[0].contents[0];
        feedEntryModel.set({
            "thumbnailUrl": mediaContents.thumbnails[0].url
        });
        feedEntryModel.set({
            "videoUrl": mediaContents.url
        });
        feedEntryModel.set({
            "category": feedEntryJson.categories[0]
        });
        feedEntryModel.set({
            "index": i
        });
        App.FeedContent.add(feedEntryModel);
    }
    togglePagination();
}

/** Routers **/
var AppRouter = Backbone.Router.extend({
    routes: {
        "": "index"
    },

    index: function () {
        this.navigate("page/1", {
            trigger: true
        });
    },

    initialize: function (options) {

        // Matches #page/10, passing "10"
        this.route("page/:number", "page", function (number) {
            //normalize page number for array/collection use
            App.CurrentPage = parseInt(number);
            //check if App.FeedEntries is initialized, else load it from the feed
            refreshFeeds(number);

        });

        this.route("next", function () {
            this.navigate("page/" + (App.CurrentPage + 1), {
                trigger: true
            });
        });

        this.route("prev", function () {
            this.navigate("page/" + (App.CurrentPage - 1), {
                trigger: true
            });
        })

    }

});

/** Handlebar Helpers **/
Handlebars.registerHelper('index-helper', function (className, index) {
    return className + index;
});

/** Backbone Views **/
var FeedContentView = Backbone.View.extend({
    model: null,
    el: $("#feedcontent-holder"),
    initialize: function () {
        this.model.on('add', this.render, this);
    },
    render: function () {
        var source = $("#feedcontent-template").html();
        var template = Handlebars.compile(source);
        this.$el.html(template({
            entries: this.model.toJSON()
        }));
    }
});

var PaginationView = Backbone.View.extend({
    model: null,
    el: $("#pagination-holder"),
    initialize: function () {
        this.render();
    },
    render: function () {
        var source = $("#pagination-template").html();
        var template = Handlebars.compile(source);
        this.$el.html(template({
            pageItems: this.model.toJSON()
        }));
    }
});

var FormView = Backbone.View.extend({
    model: null,
    el: $("#adjust-form"),
    events: {
        "click button": "adjustFeed"
    },
    adjustFeed: function (evt) {
        var numEntries = parseInt($("#num-entries")[0].value);
        var totalEntries = parseInt($("#total-entries")[0].value);

        if (numEntries && typeof numEntries === "number") {
            App.NumEntriesPerPage = numEntries;
        }
        if (totalEntries && typeof totalEntries === "number") {
            App.TotalEntries = totalEntries;
        }

        //the user goes back to the first page after fetching
        App.AppRouter.navigate("", {
            trigger: true
        });
    }
});

/** init all routers, views and global objects **/
$(function () {
    App = {};
    App.AppRouter = new AppRouter();
    App.FeedEntries = new PaginationEntries();
    App.FeedContent = new FeedContent();
    App.FeedContentView = new FeedContentView({
        model: App.FeedContent
    });
    App.PaginationView = new PaginationView({
        model: App.FeedEntries
    });
    App.FormView = new FormView();

    Backbone.history.start();
});