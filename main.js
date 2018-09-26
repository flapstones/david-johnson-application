
$(function() {
	$(window).resize(function() {
		//Rezise the feed to size of window
		$('.main-feed').css({
			height: $(window).height() - $('.navbar-inverse').height() +'px'
		});
	});
	
	//Create a namespace
	var davidApplication = {};
	
	//Create photo model
	davidApplication.Photo = Backbone.Model.extend();
	
	//This is the large photo view
	davidApplication.LargePhotoView = Backbone.View.extend({
		tagName:  "div",
		
		className: 'large-photo',
		
		initialize: function() {
			//If any changes happen such as the favourite icon the update the view
			this.listenTo(this.model, 'change', this.render);
		},
		
		template: _.template($('#large-photo-template').html()),

		events: {
			"click #back": "showAllPhotos",
			"click .favourite": "updateFavourite"
		},
		
		showAllPhotos: function() {
			davidApplication.router.navigate('');
			this.collection.trigger('all:photos');
		},
		
		updateFavourite: function() {
			//Update the favourite property - (this would save down to a database on a real application)
			if (this.model.get('favourite')) {
				this.model.set('favourite', false);
			} else {
				this.model.set('favourite', true);
			}
			$('.main-feed-list').isotope('layout');
		},

		render: function() {
			this.$el.html(this.template(this.model.toJSON()));
			return this;
		}
	});
	//This the smaller photo view in the main feed
	davidApplication.PhotoListItemView = Backbone.View.extend({
		tagName:  "div",
		
		className: 'photo-item',
		
		initialize: function() {
			this.listenTo(this.model, 'change', this.render);
		},
		
		template: _.template($('#photo-list-item-template').html()),

		events: {
			"click img": "showPhotoItem",
			"click .favourite": "updateFavourite"
		},
		
		updateFavourite: function() {
			//Update the favourite property - (this would save down to a database on a real application)
			if (this.model.get('favourite')) {
				this.model.set('favourite', false);
			} else {
				this.model.set('favourite', true);
			}
			$('.main-feed-list').isotope('layout');
		},
		
		showPhotoItem: function() {
			//Destroy the isotope plugin so it can re bind itself
			$('.main-feed-list').isotope('destroy');
			
			//This navigates to the larger photo itme view
			davidApplication.router.navigate('photoitem/'+ this.model.get('photoid'));
			var largePhotoView = new davidApplication.LargePhotoView({
				model: this.model,
				collection: this.collection
			});
			largePhotoView.render();
			$('.container .main-feed-list').html(largePhotoView.el);
		},
		
		render: function() {
			this.$el.html(this.template(this.model.toJSON()));
			
			return this;
		}
	});
	
	//This is the main collection of photos which is populated by the flickr feed
	davidApplication.PhotoCollection = Backbone.Collection.extend({
		url: 'https://api.flickr.com/services/feeds/photos_public.gne?format=json&safe_search=1',
		
		initialize: function() {
			//Bind different events to either load all photos or just add photos when scrolling
			this.on('reset', this.getAllPhotos, this);
			this.on('all:photos', this.getAllPhotos, this);
			this.on('add:photos', this.addPhotos, this);
		},

		getAllPhotos: function(firstLoad) {
			//Creat a container doc fragment to store each photo item view
			var container = document.createDocumentFragment();
			
			_.each(this.models, function(photo, i) {
				//Set my own individual ID on to each photo model - (this ID would normally be set by the backend)
				if (!photo.get('id')) {
					photo.set({photoid: i++}, {silent: true});
				}
				//Set my own favoutire property on to each photo model - (this ID would normally be set by the backend)
				if (!photo.get('favourite')) {
					photo.set({favourite: false}, {silent: true});
				}
				//Set added so I know which have been added from the infinite scroll
				if (!photo.get('added')) {
					photo.set({added: false}, {silent: true});
				}
			
				var photoListView = new davidApplication.PhotoListItemView({
					model: photo,
					collection: davidApplication.photoCollection
				});
				photoListView.render();
				//Append each item to the container - - this is so there is no appending to the actual DOM which would be slow
				container.appendChild(photoListView.el);
				
			});
			
			//Only hit the DOM once here
			$('.container .main-feed-list').html(container);
			
			var count = $('.photo-item img').length;
			var loaded = 0;

			//This is to wait for each image to have loaded, before binding the isotope layout plugin
			$('.photo-item img').each(function() {
				$(this).get(0).onload = function() {
					loaded += 1;
				
					if (loaded == count) {
						if (Isotope.data('.main-feed-list')) {
							$('.main-feed-list').isotope('destroy');
						}
						$('.main-feed-list').isotope({
							itemSelector: '.photo-item',
							masonry: {
								gutter: 20
							},
							percentPosition: true
						});
					
						$('.loading').remove();						
					}
				}
			});
		},
		
		addPhotos: function() {
			$('.photo-item img.added').removeClass('added');
			var container = document.createDocumentFragment();
			
			//This filters out any photo models which are already in the feed
			var currentPhotos = this.models.filter(function(photo) {return !photo.get('added')}).length;
			
			_.each(this.models.filter(function(photo) {return photo.get('added')}), function(photo, i) {
				if (!photo.get('photoid')) {
					photo.set({photoid: currentPhotos++}, {silent: true});
				}
				photo.set({favourite: false}, {silent: true});
				
				var photoListView = new davidApplication.PhotoListItemView({
					model: photo,
					collection: davidApplication.photoCollection
				});
				photoListView.render();
				container.appendChild(photoListView.el);
				photo.set({added: false}, {silent: true});
			});
			
			//Append the new items to the DOM
			$('.container .main-feed-list').append(container);
		
			var count = $('.photo-item img.added').length;
			var loaded = 0;
		
			$('.photo-item img.added').each(function() {
				var $this = $(this);
				$(this).get(0).onload = function() {
					loaded += 1;
					
					if (loaded == count) {
						//Tell the isotope plugin about the newly added photo items
						$('.main-feed-list').isotope('prepended', $('.photo-item img.added').parent());
						$('.main-feed-list').isotope('layout');	
						$('.loading').remove();						
					}
				}
			});
		
		},
		
		sync: function(method, collection, options) {
			//Make backbone work with JSONP to consume the flickr feed
			options.dataType = "jsonp";
			options.jsonpCallback = 'jsonFlickrFeed';
			return Backbone.sync(method, collection, options);
		},
		
		parse : function(response) {
			return response.items;
		}
	});
	
	davidApplication.photoCollection = new davidApplication.PhotoCollection();
	
	//Create the router, which tells the application what to do based on different URLS
	davidApplication.Router = Backbone.Router.extend({
		routes: {
			"": "showAllPhotos",
			"photoitem/:photoid": "showPhotoItem"
		},
		initialize: function(options) {
			this.collection = options.collection;
		},
		showAllPhotos: function() {
			$('.main-feed').prepend('<div class="loading"></div>');
			this.collection.trigger('all:photos');
		},
		showPhotoItem: function(id) {
			//This finds the individual photo model based on the photoid and then displays it
			var foundPhoto = this.collection.findWhere({photoid: id});
			if (foundPhoto) {
				var largePhotoView = new davidApplication.LargePhotoView({
					model: foundPhoto,
					collection: this.collection
				});
				largePhotoView.render();
				$('.main-feed-list').html(largePhotoView.el);
				$('.loading').remove();
			} else {
				davidApplication.router.navigate('');
				this.collection.trigger('all:photos');
			}
		}
    });
	
	//Create the main app view which creates the 'shell' for the other views to go in
	davidApplication.MainAppView = Backbone.View.extend({
		el: '.main-app-wrapper',
		
		initialize: function() {
			//This fires on load and gets the first items from the flickr feed
			davidApplication.photoCollection.fetch({
				success: function() {
					//Create the router and then kickstart it
					davidApplication.router = new davidApplication.Router({
						collection: davidApplication.photoCollection
					});
					Backbone.history.start();
					
					//Bind to the scroll event here, as the scroll event does not bubble up into a view
					$('.main-feed')
						.on('scroll', function() {
							
							//This is for the infinite scroll - to check if we are at the bottom of the page
							var gap = $('.main-feed-list').height() - $('.main-feed').height();
							if ($(this).scrollTop() >= gap) {
								//If so then get a new feed
								$.ajax({
									url: "https://api.flickr.com/services/feeds/photos_public.gne?format=json&safe_search=1",
									dataType: "jsonp", 
									jsonpCallback: 'jsonFlickrFeed',
									success: function(result) {
										$.each(result.items, function(i, photo) {
											var photoAdded = new davidApplication.Photo(photo);
											photoAdded.set({added: true}, {silent: true});
											
											//Add these new photos to the collection
											davidApplication.photoCollection.add(photoAdded);
										});
										davidApplication.photoCollection.trigger('add:photos');
									  
									}
								});
							}
						}).css({
							height: $(window).height() - $('.navbar-inverse').height() + 'px'
						});	
					
				}
			});
		},
		
		template: _.template($('#main-app-template').html()),
		//Bind the keyup event on the 'filter' input
		events: {
			"click .home": "loadMainFeed",
			'keyup #filter': 'filterContacts'
		},
		
		loadMainFeed: function(e) {
			e.preventDefault();
			//Navigate back to the home feed when clicking on the Title
			davidApplication.router.navigate('');
			$('.main-feed').prepend('<div class="loading"></div>');
			this.collection.trigger('all:photos');
		},

		filterContacts: function(e) {
			//This filters the feed based on the keyup entry
			$('.main-feed-list > .photo-item').each(function() {
				if ($(this).find('.title').text().toLowerCase().indexOf($(e.target).val().toLowerCase()) == -1) {
					$(this).hide();
				} else {
					$(this).show();
				}
			});
			//Refire theisotope layout after filtering
			$('.main-feed-list').isotope('layout');
		},
		
		render: function() {
			this.$el.html(this.template());
			$('.main-feed').prepend('<div class="loading"></div>');
		}
	});
	
	davidApplication.mainAppView = new davidApplication.MainAppView({
		collection: davidApplication.photoCollection
	});
	
	//Render the main app view which fires off its init method
	davidApplication.mainAppView.render();
	
});