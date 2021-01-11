const core = require("@actions/core");
const { execSync } = require("child_process");

// Support Functions
const createCatFile = ({ email, api_key }) => `cat >~/.netrc <<EOF
machine api.heroku.com
    login ${email}
    password ${api_key}
machine git.heroku.com
    login ${email}
    password ${api_key}
EOF`;

const addRemote = ({ app_name, buildpack, region, team }) => {
  try {
    execSync("heroku git:remote --app " + app_name);
    console.log("Added git remote heroku");
  } catch (err) {
    execSync(
      "heroku create " +
        app_name +
        (buildpack ? " --buildpack " + buildpack : "") +
        (region ? " --region " + region : "") +
        (team ? " --team " + team : "")
    );
    console.log("Successfully created a new heroku app");
  }
};

// Input Variables
let heroku = {
  api_key: core.getInput("heroku_api_key"),
  email: core.getInput("heroku_email"),
  app_name: core.getInput("heroku_app_name"),
  buildpack: core.getInput("buildpack"),
  region: core.getInput("region"),
  team: core.getInput("team"),
};

(async () => {
  // Program logic
  try {
    execSync(`git config user.name "Heroku-Deploy"`);
    execSync(`git config user.email "${heroku.email}"`);
    const status = execSync("git status --porcelain").toString().trim();
    if (status) {
      execSync(
        'git add -A && git commit -m "Commited changes from previous actions"'
      );
    }

    execSync(createCatFile(heroku));
    console.log("Created and wrote to ~/.netrc");
    execSync("heroku login");
    console.log("Successfully logged into heroku");
    addRemote(heroku);

    core.setOutput(
      "status",
      "Successfully deployed heroku app from branch " + heroku.branch
    );
  } catch (err) {
    core.setFailed(err.toString());
  }
})();
