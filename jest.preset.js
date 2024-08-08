const nxPreset = require("@nx/jest/preset").default;

module.exports = {
  ...nxPreset,
  collectCoverage: true,
  coverageReporters: ["json", "html", "text"],
  verbose: true,
};
