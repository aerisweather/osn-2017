const AWS = require('aws-sdk');
const execSync = require('child_process').execSync;
const fs = require('fs');

AWS.config.loadFromPath(`${__dirname}/../deploy-credentials.ignore.json`);

const bucketName = getBucketName();

const archiveKey = `code/archive-${Date.now()}.zip`;

// http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticache-cache-cluster.html
const STACK_NAME = 'osn2017-aeris';
const cfTemplate = {
	Resources: {
		S3:                     {
			Type:       'AWS::S3::Bucket',
			Properties: {
				BucketName: bucketName
			}
		},
		VpcMain:                {
			Type:       'AWS::EC2::VPC',
			Properties: {
				CidrBlock:          '10.0.0.0/16',
				EnableDnsHostnames: true,
				Tags:               [
					{
						Key:   'Name',
						Value: 'osn2017-main'
					}
				]

			}
		},
		VpcSubnetMain:          {
			Type:       'AWS::EC2::Subnet',
			Properties: {
				VpcId:     {Ref: 'VpcMain'},
				CidrBlock: '10.0.1.0/24',
				Tags:      [
					{
						Key:   'Name',
						Value: 'osn2017-subnet-0'
					}
				]
			}
		},
		RedisSecurityGroup:     {
			Type:       'AWS::EC2::SecurityGroup',
			Properties: {
				VpcId:                {Ref: 'VpcMain'},
				GroupName:            'osn2017-RedisCacheCluster',
				GroupDescription:     'Redis Cache Cluster',
				SecurityGroupIngress: [
					{
						CidrIp:     '10.0.0.0/16',
						IpProtocol: 'TCP',
						FromPort:   6379,
						ToPort:     6379
					}
				]
			}
		},
		RedisSubnetGroup:       {
			Type:       'AWS::ElastiCache::SubnetGroup',
			Properties: {
				CacheSubnetGroupName: 'osn2017-Redis-Main',
				Description:          'OSN2017 Redis Main Group',
				SubnetIds:            [{Ref: 'VpcSubnetMain'}]
			}
		},
		Redis:                  {
			Type:       'AWS::ElastiCache::CacheCluster',
			Properties: {
				ClusterName:          'osn2017-redis',
				CacheNodeType:        'cache.t2.micro',
				Engine:               'redis',
				NumCacheNodes:        1,
				CacheSubnetGroupName: {Ref: 'RedisSubnetGroup'},
				VpcSecurityGroupIds:  [
					{Ref: 'RedisSecurityGroup'}
				]
			}
		},
		LambdaIamRole:          {
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
					'arn:aws:iam::aws:policy/AmazonVPCFullAccess'
				]
			}
		},
		LambdaMediator:         {
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
				VpcConfig:    {
					SecurityGroupIds: [{Ref: 'RedisSecurityGroup'}],
					SubnetIds:        [{Ref: 'VpcSubnetMain'}]
				},
				Environment:  {
					Variables: {
						REDIS_HOSTNAME: {'Fn::GetAtt': ["Redis", "RedisEndpoint.Address"]},
						REDIS_PORT:     {'Fn::GetAtt': ["Redis", "RedisEndpoint.Port"]}
					}
				}
			}
		},
		LambdaAmpImageFetcher:  {
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
						MEDIATOR_ARN:  {'Fn::GetAtt': ["LambdaMediator", "Arn"]},
						CLIENT_ID:     'DsGVvRrlXhwuRAduyhx1V',
						CLIENT_SECRET: 'HTQs6AKlrWLYcVSgEW96fKuGqM6gmTX2bMXumaH8'
					}
				}
			}
		},
		LambdaGifCreator:       {
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
						S3_BUCKET:    {'Ref': 'S3'},
						MEDIATOR_ARN: {'Fn::GetAtt': ["LambdaMediator", "Arn"]}
					}
				}
			}
		},
		LambdaThumbnailCreator: {
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
				Timeout:      3,
				Handler:      'build/thumbnail-creator.handler',
				Role:         {'Fn::GetAtt': ["LambdaIamRole", "Arn"]},
				Environment:  {
					Variables: {
						S3_BUCKET:    {'Ref': 'S3'},
						MEDIATOR_ARN: {'Fn::GetAtt': ["LambdaMediator", "Arn"]}
					}
				}
			}
		},
		LambdaEmailSender:     {
			Type:       'AWS::Lambda::Function',
			Properties: {
				FunctionName: 'osn2017-email-sender',
				Description:  'Send emails',
				Runtime: 'nodejs6.10',
				Code: {
					S3Bucket: s3ArchiveLocation.Bucket,
					S3Key: s3ArchiveLocation.Key
				},
				MemorySize:   128,
				Timeout:      3,
				Handler:      'build/email-sender.handler',
				Role:         { 'Fn::GetAtt': [ "LambdaIamRole", "Arn" ]},
				Environment:  {
					Variables: {
						MEDIATOR_ARN: { 'Fn::GetAtt': [ "LambdaMediator", "Arn" ]}
					}
				}
			}
		},
	}
};

const cf = new AWS.CloudFormation();

Promise.resolve()
// Validate the CloudFormation template
	.then(() => cf
		.validateTemplate({
			TemplateBody: JSON.stringify(cfTemplate)
		})
		.promise()
	)
	// Create CF stack, or update an existing one
	.then(isExistingStack)
	.then((existingStack) => {
		if (!existingStack) {
			console.log(`Creating new stack ${STACK_NAME}...`);
			// Just create the S3 portion for now, we'll upload all the app data before creating all the lambda resources.
			return createStack(STACK_NAME, {
				Resources: {
					S3: cfTemplate.Resources.S3
				}
			});
		}
	})
	// Upload the code to s3
	.then(() => {
		console.log('Uploading updated lambda code...');
		return uploadArchive({
				Bucket: bucketName,
				Key:    archiveKey
			}
		)
	})
	// Update/Create the rest of our components
	.then(() => {
		console.log('Executing CF Change Set...');
		return executeChangeSet(cfTemplate)
	})
	.then(
		() => {
			console.log('done!');
			process.exit(0);
		},
		(err) => {
			console.error(err.stack);
			process.exit(1);
		}
	);

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

function executeChangeSet(template) {
	const changeSetName = "generated-" + Date.now();
	return cf.createChangeSet({
		ChangeSetName: changeSetName,
		StackName:     STACK_NAME,
		Capabilities:  ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'],
		TemplateBody:  JSON.stringify(template),
		ChangeSetType: 'UPDATE'
	}).promise()
		.then(() =>
			new Promise((resolve, reject) => {
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
			})
		)
		.then(() => cf.executeChangeSet({
				StackName:     STACK_NAME,
				ChangeSetName: changeSetName
			}).promise()
		)
}

function uploadArchive({Bucket, Key}) {
	console.log(`Uploading code to s3://${Bucket}/${Key}...`);
	const archiveFile = `${__dirname}/archive.zip`;
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

function getBucketName() {
	const bucketStatePath = `${__dirname}/../.bucket-name.txt`;
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