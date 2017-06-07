const AWS = require('aws-sdk');
const execSync = require('child_process').execSync;
const fs = require('fs');

AWS.config.loadFromPath(`${__dirname}/../deploy-credentials.ignore.json`);

// You'll need keys to access the AerisWeather API.
// You can sign up for a free dev account at
// https://www.aerisweather.com/signup/developer/
const CLIENT_ID = '[your_client_id]';
const CLIENT_SECRET = '[your_client_secret]';

const cf = new AWS.CloudFormation();
const archiveKey = `code/archive-${Date.now()}.zip`;
const STACK_NAME = 'osn2017-aeris';

(async () => {
	try {
		const bucketName = await getBucketName();
    const cfTemplate = {
			Resources: {
				S3:                         {
					Type:       'AWS::S3::Bucket',
					Properties: {
						BucketName: bucketName
					}
				},
				DynamoDBTable:              {
					Type:       "AWS::DynamoDB::Table",
					Properties: {
						TableName:              'osn2017-aeris',
						// Primary Key = type + dateCreated (compound)
						KeySchema:              [
							{AttributeName: "type", KeyType: "HASH"},  //Partition key
							{AttributeName: "dateCreated", KeyType: "RANGE"}  //Sort key
						],
						AttributeDefinitions:   [
							{AttributeName: "type", AttributeType: "S"},
							{AttributeName: "dateCreated", AttributeType: "N"},
							{AttributeName: "typeImageId", AttributeType: "S"},  //Partition key
							{AttributeName: "validTime", AttributeType: "N"}
						],
						// Secondary index = type + imageId + validTime
						//  sorted by validTime
						GlobalSecondaryIndexes: [
							{
								IndexName:             "typeImageId-validTime-index",
								KeySchema:             [
									// We generate the `typeImageId`, to use as a partition key
									{AttributeName: "typeImageId", KeyType: "HASH"},  //Partition key
									{AttributeName: "validTime", KeyType: "RANGE"}  //Sort key
								],
								Projection:            {
									ProjectionType: "ALL"
								},
								ProvisionedThroughput: {
									ReadCapacityUnits:  5,
									WriteCapacityUnits: 5
								}
							}
						],
						ProvisionedThroughput:  {
							ReadCapacityUnits:  5,
							WriteCapacityUnits: 5
						}
					}
				},
				LambdaIamRole:              {
					Type:       'AWS::IAM::Role',
					Properties: {
						RoleName:                 'osn2017-lambda-role',
						AssumeRolePolicyDocument: JSON.stringify(
							{
								Version:   "2012-10-17",
								Statement: [
									{
										Effect:    "Allow",
										Principal: {
											Service: "lambda.amazonaws.com"
										},
										Action:    "sts:AssumeRole"
									}
								]
							}
						),
						ManagedPolicyArns:        [
							'arn:aws:iam::aws:policy/AWSLambdaFullAccess',
							'arn:aws:iam::aws:policy/AmazonS3FullAccess',
							'arn:aws:iam::aws:policy/AmazonVPCFullAccess',
							'arn:aws:iam::aws:policy/AmazonSESFullAccess'
						]
					}
				},
				LambdaFuncMediator:         {
					Type:       'AWS::Lambda::Function',
					Properties: {
						FunctionName: 'osn2017-mediator',
						Description:  'Main brains of the Data Flow pattern',
						Runtime:      'nodejs6.10',
						Code:         {
							S3Bucket: {'Ref': 'S3'},
							S3Key:    archiveKey
						},
						MemorySize:   128,
						Timeout:      30,
						Handler:      'build/mediator.handler',
						Role:         {'Fn::GetAtt': ["LambdaIamRole", "Arn"]},
						Environment:  {
							Variables: {
								DYNAMODB_TABLE_NAME:   {Ref: 'DynamoDBTable'}
							}
						}
					}
				},
				LambdaFuncAmpImageFetcher:  {
					Type:       'AWS::Lambda::Function',
					Properties: {
						FunctionName: 'osn2017-amp-image-fetcher',
						Description:  'Fetches images and saves them to S3',
						Runtime:      'nodejs6.10',
						Code:         {
							S3Bucket: {'Ref': 'S3'},
							S3Key:    archiveKey
						},
						MemorySize:   512,
						Timeout:      60,
						Handler:      'build/amp-image-fetcher.handler',
						Role:         {'Fn::GetAtt': ["LambdaIamRole", "Arn"]},
						Environment:  {
							Variables: {
								S3_BUCKET:     {'Ref': 'S3'},
								CLIENT_ID:     CLIENT_ID,
								CLIENT_SECRET: CLIENT_SECRET
							}
						}
					}
				},
				LambdaFuncGifCreator:       {
					Type:       'AWS::Lambda::Function',
					Properties: {
						FunctionName: 'osn2017-gif-creator',
						Description:  'Combines images into a GIF and saves them to S3',
						Runtime:      'nodejs6.10',
						Code:         {
							S3Bucket: {'Ref': 'S3'},
							S3Key:    archiveKey
						},
						MemorySize:   1024,
						Timeout:      60,
						Handler:      'build/gif-creator.handler',
						Role:         {'Fn::GetAtt': ["LambdaIamRole", "Arn"]},
						Environment:  {
							Variables: {
								S3_BUCKET:    {'Ref': 'S3'}
							}
						}
					}
				},
				LambdaFuncThumbnailCreator: {
					Type:       'AWS::Lambda::Function',
					Properties: {
						FunctionName: 'osn2017-thumbnail-creator',
						Description:  'Resizes images to thumbnails and saves them to S3',
						Runtime:      'nodejs6.10',
						Code:         {
							S3Bucket: {'Ref': 'S3'},
							S3Key:    archiveKey
						},
						MemorySize:   128,
						Timeout:      30,
						Handler:      'build/thumbnail-creator.handler',
						Role:         {'Fn::GetAtt': ["LambdaIamRole", "Arn"]},
						Environment:  {
							Variables: {
								S3_BUCKET:    {'Ref': 'S3'}
							}
						}
					}
				},
				LambdaFuncEmailSender:      {
					Type:       'AWS::Lambda::Function',
					Properties: {
						FunctionName: 'osn2017-email-sender',
						Description:  'Send emails',
						Runtime:      'nodejs6.10',
						Code:         {
							S3Bucket: {'Ref': 'S3'},
							S3Key:    archiveKey
						},
						MemorySize:   128,
						Timeout:      3,
						Handler:      'build/email-sender.handler',
						Role:         {'Fn::GetAtt': ["LambdaIamRole", "Arn"]},
						Environment:  {
							Variables: {
								MEDIATOR_ARN: {'Fn::GetAtt': ["LambdaFuncMediator", "Arn"]}
							}
						}
					}
				},
			}
		};

		const existingStack = await isExistingStack();

		if (!existingStack) {
			console.log(`Creating new stack ${STACK_NAME}...`);
			// Just create the S3 portion for now, we'll upload all the app data before creating all the lambda resources.

			// Lambda functions without env vars
			const creationResources = Object.keys(cfTemplate.Resources)
				.reduce((resourceObj, lambdaResourceKey) => {
					// Hacky deep copy
					const resource = JSON.parse(JSON.stringify(cfTemplate.Resources[lambdaResourceKey]));

					if (lambdaResourceKey.startsWith('LambdaFunc')) {
						resource.Properties.Code = {
							ZipFile: '[Empty file]'
						};
						resource.Properties.Environment = {};
					}
					resourceObj[lambdaResourceKey] = resource;
					return resourceObj;
				}, {});

			await createStack(STACK_NAME, {
				Resources: creationResources
			});
		}

		console.log('Uploading updated lambda code...');
		await uploadArchive({
				Bucket: bucketName,
				Key:    archiveKey
			}
		);

		console.log('Executing CF Change Set...');
		await executeChangeSet(cfTemplate);

		console.log('done!');
		process.exit(0);
	}
	catch (err) {
		console.log(err.stack);
		process.exit(1);
	}

})();

function createStack(stackName, template) {
	return cf.createStack({
		StackName:    stackName,
		TemplateBody: JSON.stringify(template),
		Capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM']
	}).promise()
		.then(() =>
			new Promise((resolve, reject) => {
				let timeout = setInterval(() => {
					cf.describeStacks({
						StackName: STACK_NAME
					}).promise()
						.then((result) => {
							if (result.Stacks[0].StackStatus == 'CREATE_COMPLETE') {
								clearInterval(timeout);
								resolve();
							}
						})
				}, 3000);
			})
		)
		;
}

function isExistingStack() {
	return cf.describeStacks({
		StackName: STACK_NAME
	}).promise()
		.then(stackInfo => {
			return !!stackInfo.Stacks.length
		})
		.catch((err) => {
			return false;
		})
}

async function executeChangeSet(template) {
	const changeSetName = "generated-" + Date.now();
	await  cf.createChangeSet({
		ChangeSetName: changeSetName,
		StackName:     STACK_NAME,
		Capabilities:  ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'],
		TemplateBody:  JSON.stringify(template),
		ChangeSetType: 'UPDATE'
	}).promise();

	await new Promise((resolve, reject) => {
		let timeout = setInterval(() => {
			cf.describeChangeSet({
				StackName:     STACK_NAME,
				ChangeSetName: changeSetName
			}).promise()
				.then((result) => {
					if (result.ExecutionStatus == 'AVAILABLE') {
						clearInterval(timeout);
						resolve();
					}
				})
		}, 3000);
	});

	await cf.executeChangeSet({
		StackName:     STACK_NAME,
		ChangeSetName: changeSetName
	}).promise();
}

function uploadArchive({Bucket, Key}) {
	console.log(`Uploading code to s3://${Bucket}/${Key}...`);
	const archiveFile = `${__dirname}/archive.zip`;
	execSync(`npm run build`, { cwd: `${__dirname}/..` });
	execSync(`zip -r -9 ${archiveFile} ./`, {
		cwd: `${__dirname}/..`
	});
	// Load the archive into memory, and delete the file
	const archive = fs.readFileSync(archiveFile);
	const cleanup = () => fs.unlinkSync(archiveFile);

	return new AWS.S3().upload({
		Bucket,
		Key,
		Body: fs.createReadStream(archiveFile)
	})
		.promise()
		.then(() => console.log(`Uploading code... done.`))
		.then(cleanup, cleanup);
}

function makeId(length) {
	var text = "";
	var possible = "abcdefghijklmnopqrstuvwxyz0123456789";

	for (var i = 0; i < (length || 5); i++)
		text += possible.charAt(Math.floor(Math.random() * possible.length));

	return text;
}

async function getBucketName() {
	const bucketStatePath = `${__dirname}/../.bucket-name.txt`;
	try {
		const existingS3 = await cf.describeStackResource({
			StackName:         STACK_NAME,
			LogicalResourceId: 'S3'
		});
		console.log(JSON.stringify(existingS3, null, 2));
		process.exit(1);
	}
	catch (err) {

	}

	try {
		return fs.readFileSync(bucketStatePath, {encoding: 'UTF-8'});
	}
	catch (err) {
		// File didn't exist
		console.log("Bucket name didn't exist, generating a new one.");
		let bucketName = `osn2017-aeris-${makeId()}`;
		fs.writeFileSync(bucketStatePath, bucketName, {encoding: 'UTF-8'});
		console.log(`Wrote bucket name to: ${bucketStatePath}`);
		return bucketName;
	}
}