# LambdaInstances
Detect and delete unnecessary instances


Add 3 lambda functions, add roles that allow access to EC2, S3.

Run stepFunctions on a timer with line of getListOfWorkingInstances - UpdateBudgetUsage - StopInstancesById

Example of required budget file is below:

{ 
  "instances": [
    "t2.micro", "11000",
    "t2.medium", "0"
    ],
  "whitelist": [
    "i-0386f2ec23b9990c6"
    ]
}

Known caveats: this is a proof of concept that has not been used in production.
