/* global QUnit */
QUnit.config.autostart = false;

sap.ui.require([
	"sap/ui/core/Core"
], function (Core) {
	"use strict";

	Core.ready().then(function () {
		sap.ui.require([
			"com/ngr/www/presalestracker/ngrpresalestracker/test/unit/AllTests"
		], function () {
			QUnit.start();
		});
	});
});
