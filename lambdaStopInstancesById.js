'use strict';

var AWS = require('aws-sdk');
//var Promise = require('7.1.1');

exports.handler = async (event) => {
  
    var logs = getLogs(event.logs);
  
    var report = "report: "+ logs;
    var instances = event.instances;
    
    if (instances != undefined){
      for(let i in instances){
        report += (" Operation for id:" + instances[i] + " is " + await turnOffInstance(instances[i]));
        //console.log("step [" + i + "] is ready, report = " + report);
      }
    } else {
      console.log("Nothing to worry about");
    }
    
    return report;
};

function getLogs(input){
    for(var key in input)
        return input[key];
}

var actions = {
  start: function (ec2, instanceId) {
    return new Promise(function (resolve, reject) {
      var params = {
        InstanceIds: [instanceId],
        DryRun: false
      };
      ec2.startInstances(params, function(err, data) {
        if (err) {
          return reject(err);
        }
        return resolve();
      });
    });
  },
  stop: function (ec2, instanceId) {
    return new Promise(function (resolve, reject) {
      var params = {
        InstanceIds: [instanceId],
        DryRun: false
      };
      ec2.stopInstances(params, function(err, data) {
        if (err) {
          return reject(err);
        }
        return resolve();
      });
    });
  }
};

function describe(ec2, instanceId) {
  return new Promise(function (resolve, reject) {
    var params = {
      DryRun: false,
      InstanceIds: [instanceId]
    };
    ec2.describeInstances(params, function(err, data) {
      if (err) {
        return reject(err);
      }
      var ip = data.Reservations[0].Instances[0].PublicIpAddress;
      var desc = '';
      data.Reservations[0].Instances[0].Tags.forEach(function (tag) {
        desc = desc + ' ' + tag.Key + '=' + tag.Value + ' / ';
      });
      return resolve({ip: ip, description: desc});
    });
  });
}

async function turnOffInstance(instanceId){
  var action = "stop";  
  var p = actions[action];
    
  if (!p) {
    return 'unknown action';
  }
  var msgAction = action.toUpperCase() + ': ' + instanceId;
  var ec2 = new AWS.EC2();
  return await describe(ec2, instanceId).then(function (data) {
    msgAction = msgAction + ' - ' + data.ip + ' - ' + data.description;
    console.log('[INFO]', 'Attempting', msgAction);
  }).then(function () {
    console.log('[INFO]', 'Done', msgAction);
    return p(ec2, instanceId);
  }).then(function () {
    console.log('[INFO]', 'Successful!', msgAction);
    return "Successful!";
  }).catch(function (err) {
    console.log('[ERROR]', JSON.stringify(err));
    return "failed: " + err;
  });
}