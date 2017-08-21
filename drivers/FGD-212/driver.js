'use strict';

const Homey = require('homey');
const path = require('path');
const ZwaveDriver = require('homey-zwavedriver');

// http://manuals.fibaro.com/content/manuals/en/FGD-212/FGD-212-EN-T-v1.2.pdf
//
class FGD-212_Driver extends Homey.Driver {


module.exports = new ZwaveDriver(path.basename(__dirname), {
	capabilities: {
		onoff: {
			command_class: 'COMMAND_CLASS_SWITCH_MULTILEVEL',
			command_get: 'SWITCH_MULTILEVEL_GET',
			command_set: 'SWITCH_MULTILEVEL_SET',
			command_set_parser: value => ({
				Value: (value > 0) ? 'on/enable' : 'off/disable',
				'Dimming Duration': 'Factory default',
			}),
			command_report: 'SWITCH_MULTILEVEL_REPORT',
			command_report_parser: report => {
				if (report.Value === 'on/enable') return true;
				else if (report.Value === 'off/disable') return false;
				else if (typeof report.Value === 'number') return report.Value > 0;
				else if (typeof report['Value (Raw)'] !== 'undefined') return report['Value (Raw)'][0] > 0;
				return null;
			},
		},
		dim: {
			command_class: 'COMMAND_CLASS_SWITCH_MULTILEVEL',
			command_get: 'SWITCH_MULTILEVEL_GET',
			command_set: 'SWITCH_MULTILEVEL_SET',
			command_set_parser: (value, node) => {
				module.exports.realtime(node.device_data, 'onoff', value > 0);
				return {
					Value: Math.round(value * 99),
					'Dimming Duration': 'Factory default',
				};
			},
			command_report: 'SWITCH_MULTILEVEL_REPORT',
			command_report_parser: (report, node) => {
				if (report.Value === 'on/enable') {
					module.exports.realtime(node.device_data, 'onoff', true);
					return 1.0;
				}
				else if (report.Value === 'off/disable') {
					module.exports.realtime(node.device_data, 'onoff', false);
					return 0.0;
				}
				else if (typeof report.Value === 'number') {
					module.exports.realtime(node.device_data, 'onoff', report.Value > 0);
					return report.Value / 99;
				}
				else if (typeof report['Value (Raw)'] !== 'undefined') {
					module.exports.realtime(node.device_data, 'onoff', report['Value (Raw)'][0] > 0);
					if (report['Value (Raw)'][0] === 255) return 1.0;
					return report['Value (Raw)'][0] / 99;
				}
				return null;
			},
		},

		measure_power: {
			command_class: 'COMMAND_CLASS_SENSOR_MULTILEVEL',
			command_get: 'SENSOR_MULTILEVEL_GET',
			command_report: 'SENSOR_MULTILEVEL_REPORT',
			command_report_parser: report => {
				if (report['Sensor Type'] !== 'Power (version 2)') return null;

				return report['Sensor Value (Parsed)'];
			},
		},

		meter_power: {
			command_class: 'COMMAND_CLASS_METER',
			command_get: 'METER_GET',
			command_get_parser: () => ({
				Properties1: {
					Scale: 0,
				},
			}),
			command_report: 'METER_REPORT',
			command_report_parser: report => {
				if (report.hasOwnProperty('Properties2') &&
					report.Properties2.hasOwnProperty('Scale bits 10') &&
					report.Properties2['Scale bits 10'] === 0) {
					return report['Meter Value (Parsed)'];
				}
				return null;
			},
		},
	},
	settings: {
		minimum_brightness: {
			index: 1,
			size: 1,
		},
		maximum_brightness: {
			index: 2,
			size: 1,
		},
		dimming_step_auto: {
			index: 5,
			size: 1,
		},
		time_dimming_step_auto: {
			index: 6,
			size: 2,
		},
		dimming_step_manual: {
			index: 7,
			size: 1,
		},
		time_dimming_step_manual: {
			index: 8,
			size: 2,
		},
		save_state: {
			index: 9,
			size: 1,
		},
		timer_functionality: {
			index: 10,
			size: 2,
		},
		force_auto_calibration: {
			index: 13,
			size: 1,
		},
		forced_brightness_level: {
			index: 19,
			size: 1,
		},
		switch_type: {
			index: 20,
			size: 1,
		},
		double_click: {
			index: 23,
			size: 1,
		},
		'3_way_switch': {
			index: 26,
			size: 1,
		},
		switch_s1_and_s2: {
			index: 29,
			size: 1,
		},
		force_no_dim: {
			index: 32,
			size: 1,
			parser: value => new Buffer([(value) ? 2 : 0]),
		},
		soft_start: {
			index: 34,
			size: 1,
		},
		watt_report: {
			index: 50,
			size: 1,
		},
		watt_interval: {
			index: 52,
			size: 2,
		},
		kwh_report: {
			index: 53,
			size: 2,
			parser: value => new Buffer([value * 100]),
		},
		self_measurement: {
			index: 54,
			size: 1,
		},
	},
});

module.exports.on('initNode', token => {
	const node = module.exports.nodes[token];

	if (node) {

		if (typeof node.instance.CommandClass.COMMAND_CLASS_SCENE_ACTIVATION !== 'undefined') {

			node.instance.CommandClass.COMMAND_CLASS_SCENE_ACTIVATION.on('report', (command, report) => {

				if (command.hasOwnProperty('name') &&
					command.name === 'SCENE_ACTIVATION_SET') {

					if (report.hasOwnProperty('Scene ID')) {

						// Check the switch type so not all flows are being triggered
						module.exports.getSettings(node.device_data, (err, settings) => {
							if (!err &&
								settings &&
								settings.hasOwnProperty('switch_type')) {

								// Create Scene ID Data
								const data = {
									scene: report['Scene ID'].toString(),
								};

								// Switch Type = Momentary
								if (settings.switch_type === '0') {
									Homey.manager('flow').triggerDevice('FGD-212_momentary', null, data, node.device_data);
								}

								// Switch Type = Toggle
								else if (settings.switch_type === '1') {
									Homey.manager('flow').triggerDevice('FGD-212_toggle', null, data, node.device_data);
								}

								// Switch Type = Rollerblind
								else if (settings.switch_type === '2') {
									Homey.manager('flow').triggerDevice('FGD-212_roller', null, data, node.device_data);
								}
							}
						});
					}
				}
			});
		}
	}
});
