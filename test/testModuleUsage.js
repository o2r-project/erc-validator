/**
 * (C) Copyright 2017 o2r-project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

const fs = require('fs');
const path = require('path');
const assert = require('chai').assert;
const tmp = require('tmp');

const checker = require('../index').ercChecker;

const checkConfig = {
	directoryMode: false, 			// read papers from directories automatically?  (false: paths for both papers MUST be specified
	pathToMainDirectory: "",
	pathToOriginalHTML: "",
	pathToReproducedHTML: "",
	saveFilesOutputPath: "",		// necessary if diff-HTML or check metadata should be saved
	saveDiffHTML: false,
	comparisonSetBaseDir: ".",
	ercID: "",
	saveMetadataJSON: false,
	createParentDirectories: false, 	// IF outputPath does not yet exist, this flag MUST be set true; otherwise, the check fails
	quiet: false,
};

describe('Using ERC-Checker as node-module', function () {
	var testStringA = "test/TestPapers_1/testPaper_1_shortened_a.html",
		testStringB = "test/TestPapers_1/testPaper_1_shortened_b.html",
		testStringC = "test/TestPapers_2/paper_9_img_A.html",
		testStringD = "test/TestPapers_2/paper_9_img_B.html",
		testStringE = "test/TestPapers_2/paper_9_img_C.html",
		testStringF = "./path/to/nothing",
		testStringDirMode = "./test/dirModeTest";

	describe('Returned Promise should be *rejected* and Metadata in reject statement should contain Error message, when ERC-Checker', function () {
		it('should return a Promise', function () {
			let config = Object.assign({}, checkConfig);
			config.pathToOriginalHTML = testStringA;
			config.pathToReproducedHTML = testStringB;

			let checkObject1 = checker(config)
				.then(function (resolve) {
				}, function (reason) {
				});
			assert.isDefined(checkObject1.then());

			config.pathToReproducedHTML = testStringA;
			let checkObject2 = checker(config)
				.then(function (resolve) {
				}, function (reason) {
				});
			assert.isDefined(checkObject2.then());
		});

		it('is called with one or both invalid paths', function () {
			let config = Object.assign({}, checkConfig);
			config.pathToOriginalHTML = testStringA;
			config.pathToOriginalHTML = testStringF;
			checker(config)
				.then(function (resolve) {
					assert.isNull(resolve);
				}, function (reason) {
					assert.isNotEmpty(reason.errors);
					assert.include(JSON.stringify(reason.errors), "wrong path here");
					assert.include(JSON.stringify(reason.errors), testStringF);
				});

			config.pathToOriginalHTML = testStringF;
			config.pathToReproducedHTML = testStringA;
			checker(config)
				.then(function (resolve) {
					assert.isNull(resolve);
				}, function (reason) {
					assert.isNotEmpty(reason.errors);
					assert.include(JSON.stringify(reason.errors), "wrong path here");
					assert.include(JSON.stringify(reason.errors), testStringF);
				});

			config.pathToReproducedHTML = testStringF;
			checker(testStringF, testStringF)
				.then(function (resolve) {
					assert.isNull(resolve);
				}, function (reason) {
					assert.isNotEmpty(reason.errors);
					assert.include(JSON.stringify(reason.errors), "wrong path here");
					assert.include(JSON.stringify(reason.errors), testStringF);
				});
		});

		it('is called on papers containing a differing number of images', function () {
			let config = Object.assign({}, checkConfig);
			config.pathToOriginalHTML = testStringA;
			config.pathToReproducedHTML = testStringC;
			return checker(config)
				.then(function (resolve) {
					assert.isNull(resolve);
				}, function (rejectMetadata) {
					assert.isNotNull(rejectMetadata);
					assert.include(JSON.stringify(rejectMetadata.errors), "unequal number of images");
				});
		}).timeout(20000);
	});

	describe('Text differences', function () {
		let config = Object.assign({}, checkConfig);
		config.comparisonSetBaseDir = "test/TestPapers_TextDiff";
		config.pathToOriginalHTML = "textDiffTest_A.html";
		config.pathToReproducedHTML = "textDiffTest_B.html";

		it("should find text differences", function () {
			return checker(config)
				.then(function (metadata) {
					assert.isAbove(metadata.numTextDifferrences, 0, "The number of textual differences should be larger than zero.");
				}, function (error) {
					assert.ifError(error);
				}
				);
		}).timeout(20000);

		it("should fail the check", function () {
			return checker(config)
				.then(function (metadata) {
					assert.isFalse(metadata.checkSuccessful, 'The check failed');
				}
				);
		}).timeout(10000);

		it("should not have any errors", function () {
			return checker(config)
				.then(function (metadata) {
					assert.equal(0, metadata.errors.length, "No errors should have been produced.");
				}
				);
		});
	});

	describe('Returned Promise object should be *resolved* and include a Metadata object, which ', function () {

		describe('for two equal input papers', function () {
			it('should contain no errors, and a parameter {"checkSuccessful" == true}, i.e. no differences found', function () {
				let config = Object.assign({}, checkConfig);
				config.pathToOriginalHTML = testStringA;
				config.pathToReproducedHTML = testStringA;

				return checker(config)
					.then(function (metadata) {
						assert.isDefined(metadata, "No resolve metadata");
						assert.isTrue(metadata.checkSuccessful, "check should not have found differences, yet it did");
						assert.isUndefined(metadata.errors[0], "There should have been no errors, instead: " + JSON.stringify(metadata.errors));
					}, function (reason) {
						assert.ifError(reason);
					}
					);
			}).timeout(10000);
		});

		describe('for two differing papers containing 2 images each', function () {
			it('should contain no errors, and a parameter {"checkSuccessful" == false}, i.e. differences exist, plus an Array of image comparison results with a length 2', function () {
				let config = Object.assign({}, checkConfig);
				config.pathToOriginalHTML = testStringA;
				config.pathToReproducedHTML = testStringB;

				return checker(config)
					.then(function (metadata) {

						assert.isFalse(metadata.checkSuccessful, "Paper contains differences, check should find them and be unsuccessful.");

						assert.isUndefined(metadata.errors[0], "Encountered Errors should be empty, but contained  at least: " + metadata.errors[0] + " and " + metadata.errors[1] + " and " + metadata.errors[2]);
						assert.strictEqual(metadata.errors.length, 0, "Encountered Errors should be empty, but contained " + metadata.errors.length + " errors.");
						assert.strictEqual(metadata.images.length, 2, "Paper contains 9 images, but only " + metadata.images.length + " were compared / featured in result object.");
						assert.isString(metadata.display.diff, "Resulting Diff HTML is not returned correctly (not a String)");

						assert.strictEqual(metadata.images[0].compareResults.differences, 0, "Image #1 is equal in both test papers, but differences were found.");
						assert.notStrictEqual(metadata.images[1].compareResults.differences, 0, "Images #2 in test papers are different, yet no differences were found.");
					}, function (reason) {
						assert.ifError(reason);
					}
					);
			}).timeout(10000);
		});

		describe('for two papers containing 9 of 9 differing images', function () {
			it('should contain no errors, and a parameter {"checkSuccessful" == false}, i.e. differences exist, plus an Array of image comparison results with a length of 9', function () {
				let config = Object.assign({}, checkConfig);
				config.pathToOriginalHTML = testStringD;
				config.pathToReproducedHTML = testStringC;
				config.saveMetadataJSON = false;

				return checker(config)
					.then(function (metadata) {
						let i = 1;
						for (let image of metadata.images) {
							assert.notStrictEqual(image.compareResults.differences, 0, "Image #" + i + " of 9 in test paper has differences, but were not found.");
							i++;
						}

						assert.isFalse(metadata.checkSuccessful, "Paper contains differences, check should find them and be unsuccessful.");

						assert.isUndefined(metadata.errors[0], "Encountered Errors should be empty, but contained  at least: " + metadata.errors[0]);
						assert.strictEqual(metadata.errors.length, 0, "Encountered Errors should be empty, but contained " + metadata.errors.length + " errors.");
						assert.strictEqual(metadata.images.length, 9, "Paper contains 9 images, but only " + metadata.images.length + " were compared / featured in result object.");
						assert.isString(metadata.display.diff, "Resulting Diff HTML is not returned correctly (not a String)");
					}, function (reason) {
						assert.ifError(reason);
					}
					);
			}).timeout(30000);
		});

		describe('for a paper containing 9 images with only the first image differing', function () {
			it('should contain no errors, and a parameter {"checkSuccessful" == false}, i.e. differences exist, plus an Array of image comparison results with a length 9, of which only the first entry describes differences', function () {
				let config = Object.assign({}, checkConfig);
				config.pathToOriginalHTML = testStringD;
				config.pathToReproducedHTML = testStringE;
				config.saveMetadataJSON = false;

				return checker(config)
					.then(
						function (metadata) {

							metadata.images.map(function (current, index) {
								if (index == 0) {
									assert.notStrictEqual(current.compareResults.differences, 0, "First image has differences, but were not found.");
								}
								else {
									assert.strictEqual(current.compareResults.differences, 0, "Images are equal, but differences were found.");
								}
							});

							assert.isFalse(metadata.checkSuccessful, "Paper contains differences, check should find them and be unsuccessful.");

							assert.isUndefined(metadata.errors[0], "Encountered Errors should be empty, but contained  at least: " + metadata.errors[0]);
							assert.strictEqual(metadata.errors.length, 0, "Encountered Errors should be empty, but contained " + metadata.errors.length + " errors.");
							assert.strictEqual(metadata.images.length, 9, "Paper contains 9 images, but only " + metadata.images.length + " were compared / featured in result object.");
							assert.isString(metadata.display.diff, "Resulting Diff HTML is not returned correctly (not a String)");
						},
						function (reason) {
							assert.ifError(reason);
						}
					);
			}).timeout(30000);
		});
	});

	describe('For a check on two papers containing equal amount of, but differing images, and "createParentDirectories" flag set', function () {
		it('should successfully write a "diffHTML.html" file to the directory specified as Absolute Path which includes the diff image and the diff text highlighted.', function () {
			let configSaveMeta = Object.assign({}, checkConfig);
			configSaveMeta.pathToOriginalHTML = testStringA;
			configSaveMeta.pathToReproducedHTML = testStringB;
			configSaveMeta.saveFilesOutputPath = tmp.dirSync().name;
			configSaveMeta.saveDiffHTML = true;
			configSaveMeta.saveMetadataJSON = true;
			configSaveMeta.createParentDirectories = true;

			return checker(configSaveMeta)
				.then(function () {
					let htmlOutpath = path.join(configSaveMeta.saveFilesOutputPath, 'diffHTML.html');
					let savedHTMLFileContent = fs.readFileSync(htmlOutpath, 'utf-8');
					let referenceHTMLFileContent = fs.readFileSync('./test/TestPapers_TextDiff/htmlDiffTest.html', 'utf-8')

					assert.deepStrictEqual(referenceHTMLFileContent, savedHTMLFileContent, 'Saved html file varries from original check result html!');
				},
					function (reason) {
						assert.ifError(reason);
					});
		}).timeout(10000);
	});

	describe('With "saveMetadataJSON" flag set to "true", and "saveFilesOutputPath" given in the config object', function () {

		describe('for a check on two papers containing equal amount of, but differing images, and "createParentDirectories" flag set', function () {
			it('should successfully write a "metadata.json" file to the directory specified as Absolute Path', function () {
				let configSaveMeta = Object.assign({}, checkConfig);
				configSaveMeta.pathToOriginalHTML = testStringA;
				configSaveMeta.pathToReproducedHTML = testStringB;
				configSaveMeta.saveFilesOutputPath = tmp.dirSync().name;
				configSaveMeta.saveMetadataJSON = true;
				configSaveMeta.saveDiffHTML = true;
				configSaveMeta.createParentDirectories = true;

				return checker(configSaveMeta)
					.then(function () {
						let jsonOutpath = path.join(configSaveMeta.saveFilesOutputPath, 'metadata.json');

						try {
							fs.accessSync(jsonOutpath);
						}
						catch (e) {
							assert.fail('Error reading output file:' + e);
						}
					},
						function (reason) {
							assert.ifError(reason);
						});
			}).timeout(10000);
		});

		describe('for a check on two papers containing equal amount of, but differing images, and "createParentDirectories" flag set', function () {
			it('should successfully write a "metadata.json" which is matching to the original check result metadata.', function () {
				let configSaveMeta = Object.assign({}, checkConfig);
				configSaveMeta.pathToOriginalHTML = testStringA;
				configSaveMeta.pathToReproducedHTML = testStringB;
				configSaveMeta.saveFilesOutputPath = tmp.dirSync().name;
				configSaveMeta.saveMetadataJSON = true;
				configSaveMeta.saveDiffHTML = true;
				configSaveMeta.createParentDirectories = true;

				return checker(configSaveMeta)
					.then(function (resultMetadata) {
						let jsonOutpath = path.join(configSaveMeta.saveFilesOutputPath, 'metadata.json');
						let savedJSONFileContent;
						let resMeta = resultMetadata;

						savedJSONFileContent = JSON.parse(fs.readFileSync(jsonOutpath, 'utf-8'));

						resMeta = JSON.stringify(resMeta);
						savedJSONFileContent = JSON.stringify(savedJSONFileContent);

						assert.deepStrictEqual(resMeta, savedJSONFileContent, "Saved metadata.json file content varries from original check result metadata.");
					},
						function (reason) {
							assert.ifError(reason);
						});
			}).timeout(10000);
		})
	});

	describe('With "saveDiffHTML" flag set to "true", and "saveFilesOutputPath" given in the config object', function () {

		describe('for a check on two papers containing equal amount of, but differing images, and "createParentDirectories" flag set', function () {
			it('should successfully write a "diffHTML.html" file to the directory specified as Absolute Path', function () {
				let configSaveMeta = Object.assign({}, checkConfig);
				configSaveMeta.pathToOriginalHTML = testStringA;
				configSaveMeta.pathToReproducedHTML = testStringB;
				configSaveMeta.saveFilesOutputPath = tmp.dirSync().name;
				configSaveMeta.saveMetadataJSON = false;
				configSaveMeta.saveDiffHTML = true;
				configSaveMeta.createParentDirectories = true;

				return checker(configSaveMeta)
					.then(function (resultMetadata) {
						let outputFileCreated = false;
						let errorReadingOutputFile = false;
						let htmlOutpath = path.join(configSaveMeta.saveFilesOutputPath, "diffHTML.html");

						try {
							fs.accessSync(htmlOutpath);
							outputFileCreated = true;
						}
						catch (e) {
							errorReadingOutputFile = e;
						}

						assert.strictEqual(resultMetadata.errors.length, 0, "Check should not have produced Errors, yet it did: " + resultMetadata.errors);
						assert.isTrue(outputFileCreated, "Error: Output file was not created or could not be read: " + errorReadingOutputFile);
						assert.isFalse(errorReadingOutputFile, "Error reading output file: " + errorReadingOutputFile);
					});
			}).timeout(10000);
		});

		describe('for a check on two papers containing equal amount of, but differing images, a output file name passed in the config object, and "createParentDirectories" flag set', function () {
			it('should successfully write an HTML file with the specified name to the directory specified as Absolute Path', function () {
				let configSaveMeta = Object.assign({}, checkConfig);
				configSaveMeta.pathToOriginalHTML = testStringA;
				configSaveMeta.pathToReproducedHTML = testStringB;
				configSaveMeta.saveFilesOutputPath = tmp.dirSync().name;
				configSaveMeta.saveMetadataJSON = false;
				configSaveMeta.saveDiffHTML = true;
				configSaveMeta.outFileName = "specifiedName.html";
				configSaveMeta.createParentDirectories = true;

				return checker(configSaveMeta)
					.then(function (resultMetadata) {
						let outputFileCreated = false;
						let errorReadingOutputFile = false;
						let htmlOutpath = path.join(configSaveMeta.saveFilesOutputPath, "specifiedName.html");
						let resMeta = resultMetadata;

						try {
							fs.accessSync(htmlOutpath);
							outputFileCreated = true;
						}
						catch (e) {
							errorReadingOutputFile = e;
						}

						assert.strictEqual(resultMetadata.errors.length, 0, "Check should not have produced Errors, yet it did: " + resultMetadata.errors);
						assert.isTrue(outputFileCreated, "Error: Output file was not created or could not be read: " + errorReadingOutputFile);
						assert.isFalse(errorReadingOutputFile, "Error reading output file: " + errorReadingOutputFile);
					});
			}).timeout(10000);
		})
	});

	describe("Running the erc-checker in directory mode for a paper with 2 images each, one of which differing", function () {
		it("should work just as well as in file mode (see above)", function () {
			let config = Object.assign({}, checkConfig);
			config.directoryMode = true;
			config.pathToMainDirectory = testStringDirMode;
			return checker(config)
				.then(function (resultMetadata) {
					let metadata = resultMetadata;
					assert.isFalse(metadata.checkSuccessful, "Paper contains differences, check should find them and be unsuccessful.");

					assert.isUndefined(metadata.errors[0], "Encountered Errors should be empty, but contained  at least: " + metadata.errors[0] + " and " + metadata.errors[1] + " and " + metadata.errors[2]);
					assert.strictEqual(metadata.errors.length, 0, "Encountered Errors should be empty, but contained " + metadata.errors.length + " errors.");
					assert.strictEqual(metadata.images.length, 2, "Paper contains 9 images, but only " + metadata.images.length + " were compared / featured in result object.");
					assert.isString(metadata.display.diff, "Resulting Diff HTML is not returned correctly (not a String)");

					assert.strictEqual(metadata.images[0].compareResults.differences, 0, "Image #1 is equal in both test papers, but differences were found.");
					assert.notStrictEqual(metadata.images[1].compareResults.differences, 0, "Images #2 in test papers are different, yet no differences were found.");
				}, function (reason) {
					return Promise.reject(reason);
				});
		}).timeout(10000);
	});

	describe("Running the erc-checker in an environment with a `.ercignore` file and/or with acceptable file endings specified in `config` object, the ComparisonSet", function () {

		it("should only contain files, which have the required file ending", function () {
			let configTestIgnore = Object.assign({}, checkConfig);
			configTestIgnore.pathToOriginalHTML = "test_ignore8.htm";
			configTestIgnore.pathToReproducedHTML = "test_ignore10.html";
			configTestIgnore.comparisonSetBaseDir = "test/test_ercignore";
			configTestIgnore.checkFileTypes = ['html', 'htm', 'mp3'];

			return checker(configTestIgnore)
				.then(function (resultMetadata) {

					let allFilesCorrect = true;
					resultMetadata.comparisonSet.forEach(filePath => {
						assert.match(filePath, /(htm|html|mp3)/, "file path does include wanted file ending");
						assert.notMatch(filePath, /(txt|png)/, "file path does not include unwanted file ending");
					});

					assert.strictEqual(resultMetadata.comparisonSet.length, 6);
				}, function (reason) {
					return Promise.reject(reason);
				});
		});

		it("should not return any errors", function () {
			let configTestIgnore = Object.assign({}, checkConfig);
			configTestIgnore.pathToOriginalHTML = "test_ignore8.htm";
			configTestIgnore.pathToReproducedHTML = "test_ignore10.html";
			configTestIgnore.comparisonSetBaseDir = "test/test_ercignore";
			configTestIgnore.checkFileTypes = ['html', 'htm', 'mp3'];

			return checker(configTestIgnore)
				.then(function (resultMetadata) {
					assert.strictEqual(resultMetadata.errors.length, 0);
				}, function (reason) {
					return Promise.reject(reason);
				});
		});

		it("should by default only contain files having a '.htm' or '.html' ending.", function () {
			let configTestIgnore = Object.assign({}, checkConfig);
			configTestIgnore.pathToOriginalHTML = "test_ignore8.htm";
			configTestIgnore.pathToReproducedHTML = "test_ignore10.html";
			configTestIgnore.comparisonSetBaseDir = "./test/test_ercignore";
			delete configTestIgnore.checkFileTypes;

			return checker(configTestIgnore)
				.then(function (resultMetadata) {

					let allFilesCorrect = true;
					resultMetadata.comparisonSet.forEach(filePath => {
						assert.match(filePath, /(htm|html)/, "file path does include wanted file ending");
						assert.notMatch(filePath, /(txt|png|mp3)/, "file path does not include unwanted file ending");
					});

					assert.strictEqual(resultMetadata.comparisonSet.length, 5);
				});
		});

		it("should only contain files which are not ignored by `.ercignore`", function () {
			let configTestIgnore = Object.assign({}, checkConfig);
			configTestIgnore.pathToOriginalHTML = "test_ignore8.htm";
			configTestIgnore.pathToReproducedHTML = "test_ignore10.html";
			configTestIgnore.comparisonSetBaseDir = "test/test_ercignore";
			configTestIgnore.checkFileTypes = [".*"];

			return checker(configTestIgnore)
				.then(function (resultMetadata) {

					let allFilesCorrect = true;
					resultMetadata.comparisonSet.forEach(filePath => {
						assert.notInclude(filePath, "false_positive_dir", "file path does not contain ignored directory");
						assert.notInclude(filePath, "png", "comparison set file is not a png");
					});
				});
		});

		it("should not contain files which are not in check files types, nor files from `.ercignore`.", function () {
			let configTestIgnore = Object.assign({}, checkConfig);
			configTestIgnore.pathToOriginalHTML = "test_ignore8.htm";
			configTestIgnore.pathToReproducedHTML = "test_ignore10.html";
			configTestIgnore.comparisonSetBaseDir = "./test/test_ercignore";
			configTestIgnore.checkFileTypes = ["html", "htm"];

			return checker(configTestIgnore)
				.then(function (resultMetadata) {
					let allFilesCorrect = true;
					resultMetadata.comparisonSet.forEach(filePath => {
						assert.notInclude(filePath, "false_positive_dir", "file path does not contain ignored directory");
						assert.notInclude(filePath, "png", "comparison set file is not a png");
						assert.notInclude(filePath, "mp3", "comparison set file is not a png");
						assert.notInclude(filePath, "txt", "comparison set file is not a png");
					});
				});
		});
	});

});