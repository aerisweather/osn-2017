const AWS = require('aws-sdk');

AWS.config.loadFromPath(`${__dirname}/../deploy-credentials.ignore.json`);

// http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticache-cache-cluster.html
const STACK_NAME = 'osn2017-redis';
const cfTemplate = {
	Resources: {
		VpcMain:            {
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
		VpcSubnetMain:      {
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
		RedisSecurityGroup: {
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
		RedisSubnetGroup:   {
			Type:       'AWS::ElastiCache::SubnetGroup',
			Properties: {
				CacheSubnetGroupName: 'osn2017-Redis-Main',
				Description:          'OSN2017 Redis Main Group',
				SubnetIds:            [{Ref: 'VpcSubnetMain'}]
			}
		},
		Redis:              {
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
		LambdaIamRole:      {
			Type:       'AWS::IAM::Role',
			Properties: {
				RoleName:                 'osn017-lambda-role',
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
		LambdaMediator:     {
			Type:       'AWS::Lambda::Function',
			Properties: {
				FunctionName: 'osn017-mediator',
				Description:  'Main brains of the Data Flow pattern',
				Runtime: 'nodejs6.10',
				Code: {
					ZipFile: `exports.handler = (event, context, callback) => {
						// TODO implement
						callback(null, 'Hello from Lambda');
					};`
				},
				MemorySize:   128,
				Timeout:      30,
				Handler:      'build/mediator.handler',
				Role:         { 'Fn::GetAtt': [ "LambdaIamRole", "Arn" ]},
				VpcConfig:    {
					SecurityGroupIds: [{Ref: 'RedisSecurityGroup'}],
					SubnetIds:        [{Ref: 'VpcSubnetMain'}]
				},
				Environment:  {
					Variables: {
						REDIS_HOSTNAME: { 'Fn::GetAtt': [ "Redis", "RedisEndpoint.Address" ]},
						REDIS_PORT: { 'Fn::GetAtt': [ "Redis", "RedisEndpoint.Port" ]}
					}
				}
			}

		}
	}
};

const cf = new AWS.CloudFormation({
	region: 'us-east-1'
});


cf
	.validateTemplate({
		TemplateBody: JSON.stringify(cfTemplate)
	})
	.promise()
	.then(isExistingStack)
	.then((existingStack) => {
		if (existingStack) {
			console.log("Template validated, updating resources...");
			return executeChangeSet(cfTemplate);
		}
		else {
			console.log("Template validated, creating resources...");
			return cf.createStack({
				StackName:    STACK_NAME,
				TemplateBody: JSON.stringify(cfTemplate),
				Capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM']
			}).promise();
		}
	})
	.catch((err) => console.error(err.stack));

function isExistingStack() {
	return cf.describeStacks({
		StackName: STACK_NAME
	}).promise()
		.then(stackInfo => {
			return stackInfo.Stacks.length
		})
		.catch((err) => {
			return false;
		})
}

function executeChangeSet(template) {
	const changeSetName = "generated-" + Date.now();
	return cf.createChangeSet({
		ChangeSetName: changeSetName,
		StackName: STACK_NAME,
		Capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'],
		TemplateBody: JSON.stringify(template),
		ChangeSetType: 'UPDATE'
	}).promise()
		.then(() =>
			new Promise((resolve, reject) => {
				let timeout = setInterval(() => {
					cf.describeChangeSet({
						StackName: STACK_NAME,
						ChangeSetName: changeSetName
					}).promise()
						.then((result) => {
							if(result.ExecutionStatus == 'AVAILABLE') {
								clearInterval(timeout);
								resolve();
							}
						})
				}, 3000);
			})
		)
		.then(() => cf.executeChangeSet({
				StackName: STACK_NAME,
				ChangeSetName: changeSetName
			}).promise()
		)
}