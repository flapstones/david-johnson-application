
$(function() {
	$(window).resize(function() {
		$('.main-feed').css({
			height: $(window).height() - $('.navbar-inverse').height() +'px'
		});
	});
	
	var davidApplication = {};
	
	davidApplication.Photo = Backbone.Model.extend();
	
	davidApplication.LargePhotoView = Backbone.View.extend({
		tagName:  "div",
		
		className: 'large-photo',
		
		initialize: function() {
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
			if (this.model.get('favourite')) {
				this.model.set('favourite', false);
			} else {
				this.model.set('favourite', true);
			}
			$('.main-feed-list').isotope('layout');
		},
		
		showPhotoItem: function() {
			$('.main-feed-list').isotope('destroy');
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
	
	davidApplication.PhotoCollection = Backbone.Collection.extend({
		url: 'https://api.flickr.com/services/feeds/photos_public.gne?format=json&safe_search=1',
		
		initialize: function() {
			this.on('reset', this.getAllPhotos, this);
			this.on('all:photos', this.getAllPhotos, this);
			this.on('add:photos', this.addPhotos, this);
		},

		getAllPhotos: function(firstLoad) {
			var container = document.createDocumentFragment();
			
			_.each(this.models, function(photo, i) {
				if (!photo.get('id')) {
					photo.set({photoid: i++}, {silent: true});
				}
				if (!photo.get('favourite')) {
					photo.set({favourite: false}, {silent: true});
				}
				if (!photo.get('added')) {
					photo.set({added: false}, {silent: true});
				}
			
				var photoListView = new davidApplication.PhotoListItemView({
					model: photo,
					collection: davidApplication.photoCollection
				});
				photoListView.render();
				container.appendChild(photoListView.el);
				
			});
			
			$('.container .main-feed-list').html(container);
			
			var count = $('.photo-item img').length;
			var loaded = 0;

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
			
			$('.container .main-feed-list').append(container);
		
			var count = $('.photo-item img.added').length;
			var loaded = 0;
		
			$('.photo-item img.added').each(function() {
				var $this = $(this);
				$(this).get(0).onload = function() {
					loaded += 1;
				
					if (loaded == count) {
						$('.main-feed-list').isotope('prepended', $('.photo-item img.added').parent());
						$('.main-feed-list').isotope('layout');	
						$('.loading').remove();						
					}
				}
			});
		
		},
		
		sync: function(method, collection, options) {
			options.dataType = "jsonp";
			options.jsonpCallback = 'jsonFlickrFeed';
			return Backbone.sync(method, collection, options);
		},
		
		parse : function(response) {
			return response.items;
		}
	});
	
	davidApplication.photoCollection = new davidApplication.PhotoCollection();
	
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
	
	davidApplication.MainAppView = Backbone.View.extend({
		el: '.main-app-wrapper',
		
		initialize: function() {
			
			davidApplication.photoCollection.fetch({
				success: function() {
					davidApplication.router = new davidApplication.Router({
						collection: davidApplication.photoCollection
					});
					Backbone.history.start();
					
					$('.main-feed')
						.on('scroll', function() {
							var gap = $('.main-feed-list').height() - $('.main-feed').height();
							if ($(this).scrollTop() >= gap) {
								$.ajax({
									url: "https://api.flickr.com/services/feeds/photos_public.gne?format=json&safe_search=1",
									dataType: "jsonp", 
									jsonpCallback: 'jsonFlickrFeed',
									success: function(result) {
										$.each(result.items, function(i, photo) {
											var photoAdded = new davidApplication.Photo(photo);
											photoAdded.set({added: true}, {silent: true});
											
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

		events: {
			"click .title": "loadMainFeed",
			'keyup #filter': 'filterContacts'
		},
		
		loadMainFeed: function(e) {
			e.preventDefault();
			$('.main-feed').prepend('<div class="loading"></div>');
			this.collection.trigger('all:photos');
		},

		filterContacts: function(e) {
			$('.main-feed-list > .photo-item').each(function() {
				if ($(this).find('.title').text().toLowerCase().indexOf($(e.target).val().toLowerCase()) == -1) {
					$(this).hide();
				} else {
					$(this).show();
				}
			});
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
	
	davidApplication.mainAppView.render();

	//TODO github account and description explaining
	
});