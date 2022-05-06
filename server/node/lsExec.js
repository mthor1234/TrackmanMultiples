// Calls a powershell script on my local machine
// I want this to handle resizing the browser so the QR code can be displayed in full screen
// then dynamically resize to show the timer after payment has been processed

var spawn = require("child_process").spawn,child;

// child = spawn("powershell.exe",["c:\\temp\\helloworld.ps1"]);
child = spawn("powershell.exe",["C:\\Users\\Admin\\Trackman` `Kiosk\\checkout-one-time-payments\\server\\node\\scripts.ps1"]);

child.stdout.on("data",function(data){
    console.log("Powershell Data: " + data);
});
child.stderr.on("data",function(data){
    console.log("Powershell Errors: " + data);
});
child.on("exit",function(){
    console.log("Powershell Script finished");
});
child.stdin.end(); //end input