System.register([], function (exports, module) {
	'use strict';
	return {
		execute: function () {

			module.import('./generated-chunk2.js').then(({dynamic}) => console.log('main1', dynamic));

		}
	};
});
