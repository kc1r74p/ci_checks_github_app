var http = require('http');
var fs = require('fs');
var createHandler = require('github-webhook-handler');
var createApp = require('github-app');

//todo: cleanup
var handler = createHandler({
  path: '/',
  secret: 'somerandom' || process.env.WEBHOOK_SECRET || 'development'
});

//todo: cleanup
http.createServer(function (req, res) {
  handler(req, res, function (err) {
    res.statusCode = 404;
    res.end('no such location');
  });
}).listen(5000 || process.env.PORT, function(){console.log("Github App - Server running...");});

var app = createApp({
  //todo: cleanup
  id: 24771 || process.env.APP_ID ,
  cert: process.env.PRIVATE_KEY || fs.readFileSync('private-key.pem')
});

handler.on('error', function (err) {
  console.error('Error:', err.message)
});

//todo: cleanup
handler.on('installation', function (event) {
  if (event.payload.action == 'created') {
    console.log("App installed"); //, event.payload.installation);
  } else if (event.payload.action == 'deleted') {
    console.log("App uninstalled"); //, event.payload.installation);
  }
});

//testing
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

//PR open, close ...
handler.on('pull_request', function(event){
  if (event.payload.action == 'opened' || event.payload.action == 'reopened') {       
    //create check for head...
    handlePREvent(event);
  }
});

//new commit, let´s get it and run tests... then report back result
handler.on('check_suite', function (event) {
  //new commits + manuel check request
  if (event.payload.action == 'requested' || event.payload.action == 'rerequested') {
    handleCheckEvent(event);
  }
});

//todo: cleanup
function handleCheckEvent(event){
  var check_suite = event.payload.check_suite;
  var check_name = 'Concourse Ci Build';
  var installation = event.payload.installation.id;

  //var repo = event.payload.repository;
  //console.log("New commit, check run triggered", check_suite, repo);

  //we only want to run on commits which are part of a PR so skip everything which has no PR
  if(check_suite.pull_requests.length < 1){
    console.log("Commit without PR assoc... skipping. [" + check_suite.head_sha + "]");
    return;
  }

  var pr = check_suite.pull_requests[0].head;

  
  app.asInstallation(installation).then(function (github) {
    console.log("Created in progress check run .... [" + pr.sha + "]");
    //tell github CI working on it
    github.checks.create({
      owner: check_suite.head_commit.author.name,
      repo: pr.repo.name, //repo.name,
      name: check_name,
      head_sha: pr.sha, //check_suite.head_sha,
      status: 'in_progress',
      started_at: new Date().toISOString(),
      output: {
        title: 'Building commit ...',
        summary: 'Working ...',
        text: 'Test'
      },
      actions: []
    }).then(async function(ret){

      //todo: here we want to trigger the real build
      //best way -> fly as npm package to talk to concourse directly...
      //maybe for PoC just get most important fly --verbose REST calls and set up hacky ...
      
      //depending on the check above which we want to run here, or multiple checks
      //# build concourse pipe for each check type: build, tests, lint, ...
      //1. choose todo: group in pipe or whole pipe for each PR/commit
      //   - what about concurrent runs, multiple DB states, take into consideration ...
      //2. how to build pipe yml with correct check scripts 
      //3. fly
      //4. trigger run + update github check status
      //5. monitor run
      //6. if done update github check like below with conclusion ...

      //testing
      await sleep(30000);
      return ret;
    }).then(function(ret){

      var check_suite_returned = ret.data.check_suite;

      //get check runs, aka the one we just created above
      github.checks.listForSuite({
        owner: check_suite.head_commit.author.name,
        repo: pr.repo.name,
        check_suite_id: check_suite_returned.id,
        head_sha: pr.sha,
        name: check_name,
        status: 'in_progress'
      }).then(function(arr){
        arr.data.check_runs.forEach(function (item) {
          //done for id
          github.checks.update({
            owner: check_suite.head_commit.author.name,
            repo: pr.repo.name,
            check_run_id: item.id,
            name: check_name,
            head_sha: pr.sha,
            conclusion: 'success',
            status: 'completed',
            completed_at: new Date().toISOString(),
            output: {
              title: 'Finished Build',
              summary: 'Finished',
              text: 'Test 2'
            },
            actions: []
          }).then(function(ret){          
            console.log("Completed in progress check run [" + item.id + "]");
          });
        });
      });
    });
  });
}

//todo: refactor duplicate code
function handlePREvent(event){
  var pr = event.payload.pull_request;
  var installation = event.payload.installation.id;
  var check_name = 'Concourse Ci Build';

  console.log("PR [" + pr.url + "]");
    
  app.asInstallation(installation).then(function (github) {
    console.log("Created in progress check run .... [" + pr.head.sha + "]");
    //tell github CI working on it
    github.checks.create({
      owner: pr.head.user.login,
      repo: pr.head.repo.name,
      name: check_name,
      head_sha: pr.head.sha, 
      status: 'in_progress',
      started_at: new Date().toISOString(),
      output: {
        title: 'Building commit ...',
        summary: 'Working ...',
        text: 'Test'
      },
      actions: []
    }).then(async function(ret){
      await sleep(15000);
      return ret;
    }).then(function(ret){

      var check_suite_returned = ret.data.check_suite;

      //get check runs, aka the one we jut created above
      github.checks.listForSuite({
        owner: pr.head.user.login,
        repo: pr.head.repo.name,
        check_suite_id: check_suite_returned.id,
        head_sha: pr.head.sha,
        name: check_name,
        status: 'in_progress'
      }).then(function(arr){
        arr.data.check_runs.forEach(function (item) {
          //done for id
          github.checks.update({
            owner: pr.head.user.login,
            repo: pr.head.repo.name,
            check_run_id: item.id,
            name: check_name,
            head_sha: pr.head.sha,
            conclusion: 'success',
            status: 'completed',
            completed_at: new Date().toISOString(),
            output: {
              title: 'Finished Build',
              summary: 'Finished',
              text: 'Test 2'
            },
            actions: []
          }).then(function(ret){          
            console.log("Completed in progress check run [" + item.id + "]");
          });
        });
      });

      
    });
  });

}
