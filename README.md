# OSN 2017: Using AWS Lambda to Create Weather GIFs

Demo code and slides from our Open Source North 2017 presentation.

> We will perform a live demo using AWS Lambda to generate animated weather maps from AerisWeather data. This talk will go a step beyond the basic "Hello World" Lambda demonstration, and dive into some of the real-world challenges that you may run into with Lambda: "How do I logically organize my code? How do I maintain state in a "stateless" environment'? How do I define data transformation pipelines?" We will also talk through our decision-making process in using Lambda, and discuss how it it changed the way we think about our code.


## We're Hiring!

Do you like our demo, and want to do more stuff like it? Or do you hate the demo, and want to tell us how to do it right? Either way, come work at AerisWeather, and you can do interesting stuff like this all the time.

We're a small team, but we get to do a lot of interesting work. We're always messing with new tools and patterns. And we get to work on [open source projects all the time](https://github.com/aerisweather). Sometimes we even get to present at conferences!

https://www.aerisweather.com/careers/

## Demo Code

The code we're referencing in our talk is all located at [demo/src](demo/src).

**Workers**

* [amp-image-fetcher](demo/src/amp-image-fetcher.js)
* [thumbnail-creator](demo/src/thumbnail-creator.js)
* [gif-creator](demo/src/gif-creator.js)
* [email-sender](demo/src/email-sender.js)

[mediator](demo/src/mediator.js)

[Lambda invocation script](demo/script/invoke.js)

[CloudFormation provisioning script](demo/deployment/provision.js)


## Slides

We are using [remark](https://github.com/gnab/remark) to serve slides, which allows us to write our slides with [markdown formatting](slides/osn-2017-aws-lambda.md).

To display the slides, we're running a little HTTP server:

```bash
$ cd slides
$ ./start-server.sh
Starting presentation web server
http://localhost:8000/slideshow.html
Serving HTTP on 0.0.0.0 port 8000 ...
```

## Setup and Deployment

Our demo is written for Node.js. If you don't have it already, you'll need to [download node](https://nodejs.org/en/download/).

To install vendor dependencies, run:

```bash
$ npm install
```

### AerisWeather API Account

To fetch images from the AerisWeather mapping platform, you will need to [sign up for a free dev account](https://www.aerisweather.com/signup/developer/). Follow the instructions to generate API keys, which you'll need to insert in [the provisioning script](demo/deployment/provision.js#L10)

### Creating AWS Resources

We use a CloudFormation template to manage our AWS resources. You can see the template and the CloudFormation deployment script in [demo/deployment/provision.js](demo/deployment/provision.js). 

You will need to create an AWS account, if you don't have one already. To configure your credentials, copy [demo/deployment/deploy-credentials.example.json](demo/deployment/deploy-credentials.example.json) to [demo/deployment/deploy-credentials.ignore.json](demo/deployment/deploy-credentials.ignore.json), and enter in your AWS credentials.

Then simply run 
```
npm run deploy
```
and CloudFormation will create all the necessary AWS resources.

You can also take a look at our open source [deploy-cloud-formation](https://github.com/aerisweather/deploy-cloud-formation) tool, for simplified CF deployments. We also have a [deploy-lambda-function](https://github.com/aerisweather/node-deploy-lambda-function) tool for bundling and configuring lambda functions.

### CloudWatch Events

In our talk, we'll show you how to setup a cron-like timer, to invoke our lambda function every 7 minutes. This timer is not included in the CloudFormation template, but you can set one up by going to `AWS > CloudWatch > Events`
 
### Invoking lambda functions

To manually invoke the lambda functions, you can use the [lambda cli tool](http://docs.aws.amazon.com/cli/latest/reference/lambda/invoke.html), our you can use our invocation script.

```bash
$ ./demo/script/invoke [workerName] [pathToMessageJson]

eg.
$ ./demo/script/invoke amp-image-fetcher ./demo/messages/please-fetch-image.json
```