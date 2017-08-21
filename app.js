"use strict";

const Homey = require('homey'); 

class FupgradeApp extends Homey.App{ 

  onInit() {
    this.log("Fupgrade is ready ");

    let mDrivers = Homey.ManagerDrivers;
    let drivers = mDrivers.getDrivers();

    this.log(drivers);
    drivers.forEach(driverId => {
      driver = drivers[driverId];

      this.log("["+driverId+"] "+driver.name);

      devices = driver.getDevices();
      devices.forEach(deviceId => {
        device = devices[deviceId];
        this.log("\t["+device.getName()+"] "+getClass());
      });
    });
  }

}

module.exports = FupgradeApp
