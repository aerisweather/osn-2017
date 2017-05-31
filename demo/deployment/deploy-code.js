#!/usr/bin/env node
const AWS = require('aws-sdk');
const execSync = require('child_process').execSync;
const fs = require('fs');

(() => {
	AWS.config.loadFromPath(`${__dirname}/deploy-credentials.ignore.json`);

	// Create a zip archive of the code
	console.log('Archiving code...');
	const archiveFile = `${__dirname}/archive.zip`;
	execSync(`zip -r -9 ${archiveFile} ./`, {
		cwd: process.cwd()
	});
	// Load the archive into memory, and delete the file
	const archive = fs.readFileSync(archiveFile);
	fs.unlinkSync(archiveFile);
	console.log('Archiving code... done.');

	// Update code for all lambda functions
	console.log(`Uploading code to lambda functions...`);
	const lambda = new AWS.Lambda({region: 'us-east-1'});
	const lambdaFunctions = [
		'osn2017-amp-image-fetcher',
		'osn2017-gif-creator',
		'osn2017-thumbnail-creator',
		'osn2017-mediator'
	];
	return Promise.all(
		lambdaFunctions.map(fName =>
			lambda.updateFunctionCode({
				FunctionName: fName,
				Publish:      true,
				ZipFile:      archive
			}).promise()
				.then(res => console.log(`Uploaded ${fName} v${res.Version}`))
		)
	)
		.then(() => {
			console.log(`Uploading code to lambda functions... done!`)
		})
})()
	.then(
		() => {
			console.log('Deployment complete');
			process.exit(0);
		},
		err => {
			console.error(`Deployment failed: ${err}`);
			process.exit(1);
		}
	);