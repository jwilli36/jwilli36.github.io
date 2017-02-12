"use strict";

//       DATA MODEL          

var places = [
	{
		name: 'Apostolic Church of God',
		address: '6320 S. Dorchester Ave, Chicago, IL 60637',
		lat: 41.7801382,
		lng: -87.5926356,
		info: 'Church of God',
		tags: ['Church'],
	},
	{
		name: 'Grand Lux Café',
		address: '600 N Michigan Ave, Chicago, IL 60411',
		lat: 41.8932,
		lng: -87.624535,
		info: 'High End Restaurant',
		tags: ['Food', 'Dessert']
	},
	{
		name: 'Sugar Shack',
		address: '630 W 26th St, Chicago, IL 60616',
		lat: 41.8455135,
		lng: -87.6428153,
		info: 'Ice cream and cakes',
		tags: ['Dessert']
	},
	{
		name: 'Lumes Pancake House',
		address: '11601 S Western, Chicago, Il 60643',
		lat: 41.682408,
		lng: -87.6804617,
		info: 'Breakfast Restaurant',
		tags: ['Family', 'Breakfast']
	},
	{
		name: 'STACKED',
		address: '5237 W 95th St, Oak Lawn, IL 60453',
		lat: 41.7196111,
		lng:  -87.7528999,
		info: 'Unique Breakfast Food',
		tags: ['Breakfast']
	},
	{
		name: 'Jazz Showcase',
		address: '806 S Plymouth Ct, Chicago, IL 60605',
		lat: 41.8717103,
		lng: -87.6288108,
		info: 'Jazz Music',
		tags: ['Entertainment', 'Music']
	},
	{
		name: 'Weber\'s, Bakery',
		address: '7055 W Archer Ave, Chicago, IL 60638',
		lat: 41.7917142,
		lng: -87.7986611,
		info: 'Breakfast',
		tags: ['Food', 'Dessert']
	},
	{
		name: 'Publican Quality Meats',
		address: '825 W Fulton Market, Chicago, IL 60607',
		lat: 41.8866042,
		lng: -87.6485378,
		info: 'Deli',
		tags: ['Food', 'Drinks']
	}
];

//         GOOGLE MAPS        
var gMap = {
	map: {},
	infoWindow: new google.maps.InfoWindow(), // reusable info window
	options: {
		center: { lat: 41.795296, lng: -87.624742},
		zoom: 11
	},
	infoWindowContent: '<div class="info-window"><div class="window-title">%title%</div><div class="window-description">%description%</div></div>',
	init: function(vm) {
		gMap.map = new google.maps.Map(document.getElementById('map'), gMap.options);
		// shows markers depending on which loads faster - vm or google map
		if (vm.initialized && !vm.hasMarkers) vm.showMarkers();
	}
};

// *         PLACE OBJECT        *
var Place = function(data, parent) {
	// info from provided data model
	this.name = ko.observable(data.name);
	this.info = ko.observable(data.info);
	this.address = ko.observable(data.address);
	this.tags = ko.observableArray(data.tags);
	this.lat = ko.observable(data.lat);
	this.lng = ko.observable(data.lng);

	// if this place has extra info via ajax
	this.initialized = ko.observable(false);

	// google maps marker
	var marker = new google.maps.Marker({
		position: new google.maps.LatLng(data.lat, data.lng),
		icon: 'img/arrow.png'
	});

	// click handler for google maps marker
	google.maps.event.addListener(marker, 'click', (function(place, parent) {
		return function() {
			// tell viewmodel to show this place
			parent.showPlace(place);
		};
	}) (this, parent));
	this.marker = marker;
};

//        FILTER OBJECT       
var Filter = function(data) {
	this.name = ko.observable(data.name);
	this.on = ko.observable(true);
};

//          VIEW MODEL        
var ViewModel = function() {
	var self = this;
	self.searchFilter = ko.observable('');
	self.currentPlace = ko.observable();
	self.initialized = false;
	self.hasMarkers = false;
	self.connectionError = ko.observable(false);

	// *            INITIALIZE             *
	self.init = function() {
		var tempTagArr = [];
		var tempFilterArr = [];

		// create container for places
		self.placeList = ko.observableArray([]);

		// loop through places array and convert to ko object
		places.forEach(function(place) {
			self.placeList.push(new Place(place, self));

			// loop through tags for each place and add to self.filters
			place.tags.forEach(function(tag){
				// if current tag is not already a filter, add to self.filters
				if (tempTagArr.indexOf(tag) < 0) {
					tempTagArr.push(tag);
				}
			});// end tag loop
		});// end place loop

		// loop through tags and make filter objects from them
		tempTagArr.forEach(function(tag){
			tempFilterArr.push(new Filter({name: tag}));
		});

		// set filters based on temporary array
		// this has performance benefits over pushing items one at a time
		self.filters = ko.observableArray(tempFilterArr);

		// array of filters currently applied
		self.currentFilters = ko.computed(function() {
			var tempCurrentFilters = [];

			// loop through filters and get all filters that are on
			ko.utils.arrayForEach(self.filters(), function(filter){
				if (filter.on()) tempCurrentFilters.push(filter.name());
			});

			return tempCurrentFilters;
		});

		// array of places to be shown based on currentFilters
		self.filteredPlaces = ko.computed(function() {
			var tempPlaces = ko.observableArray([]);
			var returnPlaces = ko.observableArray([]);

			// apply filter
			ko.utils.arrayForEach(self.placeList(), function(place){
				var placeTags = place.tags();

				// loop through all tags for a place and
				// determine if any are also a currently applied filter
				var intersections = placeTags.filter(function(tag){
					return self.currentFilters().indexOf(tag) != -1;
				});

				// if one or more tags for a place are in a filter, add it
				if (intersections.length > 0) tempPlaces.push(place);
			});

			var tempSearchFilter = self.searchFilter().toLowerCase();

			// if there is no additional text to search for, return filtered places
			if (!tempSearchFilter){
				returnPlaces = tempPlaces();
			}
			// if user is also searching via text box, apply text filter
			else{
				returnPlaces = ko.utils.arrayFilter(tempPlaces(), function(place) {
		        	return place.name().toLowerCase().indexOf(tempSearchFilter) !== -1;
		        });
			}

			// hide/show correct markers based on list of current places
			self.filterMarkers(returnPlaces);
			return returnPlaces;

		});

		// if no markers have been shown, show them
		if (!self.hasMarkers) self.showMarkers();
		self.initialized = true;
	};

	//          FUNCTIONS          

	// shows/hides correct map markers
	self.filterMarkers = function(filteredPlaces) {
		ko.utils.arrayForEach(self.placeList(), function(place){
			if (filteredPlaces.indexOf(place) === -1) {
				place.marker.setVisible(false);
			}
			else{
				place.marker.setVisible(true);
			}
		});
	};

	// turns filter on or off
	// called when filter is clicked in view
	self.toggleFilter = function(filter) {
		filter.on(!filter.on());
	};

	// show the currently selected place
	// called when list item or map marker is clicked
	self.showPlace = function(place) {
		// set info window content and show it
		gMap.infoWindow.setContent(gMap.infoWindowContent.replace('%title%', place.name()).replace('%description%', place.address()));
		gMap.infoWindow.open(gMap.map, place.marker);

		// set the old marker icon back
		if (self.currentPlace()) self.currentPlace().marker.setIcon('img/arrow.png');

		// set new marker to selected icon
		place.marker.setIcon('img/marker_selected.png');

		// reset error status
		self.connectionError(false);

		// if place does not have additional info via ajax
		if (!place.initialized()) {

			// call to get initial information
			$.ajax({
				url: 'https://api.foursquare.com/v2/venues/search?ll='+place.lat()+','+place.lng()+'&intent=match&name='+place.name()+'&client_id=EP2TQZM2U0XBQVT3SB4CA4QW41JRPSKLJ2YVCAAS2VEV0YKI&client_secret=KGVU5QZQIWN4B2D3SYRYXKBDR1BXMSR2L2XC3VJRROIQCCMI&v=20150828'
			})
			.done(function(data){
				var venue = data.response.venues[0];

				//set fetched info as properties of Place object
				place.id = ko.observable(venue.id);

				if (venue.hasOwnProperty('url')) {
					place.url = ko.observable(venue.url);
				}
				if (venue.hasOwnProperty('contact') && venue.contact.hasOwnProperty('formattedPhone')) {
					place.phone = ko.observable(venue.contact.formattedPhone);
				}

				// use id to get photo
				$.ajax({
					url: 'https://api.foursquare.com/v2/venues/'+place.id()+'/photos?client_id=EP2TQZM2U0XBQVT3SB4CA4QW41JRPSKLJ2YVCAAS2VEV0YKI&client_secret=KGVU5QZQIWN4B2D3SYRYXKBDR1BXMSR2L2XC3VJRROIQCCMI&v=20150828'
				})
				.done(function(data){
					// set first photo url as the place photo property
					var photos = data.response.photos.items;
					place.photo = ko.observable(photos[0].prefix + 'width400' + photos[0].suffix);
					place.initialized(true);

					// set current place and scroll user to information
					self.currentPlace(place);
					self.scrollTo('#info-container');
				})
				.fail(function(err) {
					// if there is an error, set error status and scroll user to the info
					self.connectionError(true);
					self.scrollTo('#info-container');
				});

			})
			.fail(function(err) {
				// if there is an error, set error status and scroll user to the info
				self.connectionError(true);
				self.scrollTo('#info-container');
			});
		}
		// if place has already fetched data
		else {
			// set current place and scroll user to information
			self.currentPlace(place);
			self.scrollTo('#info-container');
		}
	};

	// helper function to scroll user to specified element
	// el is a string representing the element selector
	self.scrollTo = function(el) {
		$('html, body').animate({ scrollTop: $(el).offset().top }, "slow");
	};

	// show marker for each place
	self.showMarkers = function() {
		ko.utils.arrayForEach(self.placeList(), function(place){
			place.marker.setMap(gMap.map);
		});

		self.hasMarkers = true;
	};
};


//     SETUP            


// empty view model
var vm = new ViewModel();

// listener for view model initialization
$( document ).ready(function() {
	vm.init();
	ko.applyBindings(vm);

	// resize map and reset center when window size changes
	$(window).on('resize', function() {
		google.maps.event.trigger(gMap.map, 'resize');
		gMap.map.setCenter(gMap.options.center);
	});
});
// listener for google map initialization
google.maps.event.addDomListener(window, 'load', gMap.init(vm));













