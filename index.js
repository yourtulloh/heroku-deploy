const p = require("phin");
const core = require("@actions/core");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

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
    execSync(createCatFile(heroku));
    console.log("Created and wrote to ~/.netrc");
    execSync("heroku login");
    console.log("Successfully logged into heroku");
    addRemote(heroku);

    // Just Login
    if (heroku.justlogin) {
      return;
    }

    execSync(`git config user.name "Heroku-Deploy"`);
    execSync(`git config user.email "${heroku.email}"`);
    const status = execSync("git status --porcelain").toString().trim();
    if (status) {
      execSync(
        'git add -A && git commit -m "Commited changes from previous actions"'
      );
    }

    // Check if using Docker
    if (!heroku.usedocker) {
      // Check if Repo clone is shallow
      const isShallow = execSync(
        "git rev-parse --is-shallow-repository"
      ).toString();

      // If the Repo clone is shallow, make it unshallow
      if (isShallow === "true\n") {
        execSync("git fetch --prune --unshallow");
      }
    }

    execSync(createCatFile(heroku));
    console.log("Created and wrote to ~/.netrc");

    createProcfile(heroku);

    execSync("heroku login");
    if (heroku.usedocker) {
      execSync("heroku container:login");
    }
    console.log("Successfully logged into heroku");

    addRemote(heroku);
    addConfig(heroku);

    try {
      deploy({ ...heroku, dontuseforce: true });
    } catch (err) {
      console.error(`
            Unable to push branch because the branch is behind the deployed branch. Using --force to deploy branch. 
            (If you want to avoid this, set dontuseforce to 1 in with: of .github/workflows/action.yml. 
            Specifically, the error was: ${err}
        `);

      deploy(heroku);
    }

    if (heroku.healthcheck) {
      if (typeof heroku.delay === "number" && heroku.delay !== NaN) {
        await sleep(heroku.delay * 1000);
      }

      try {
        const res = await p(heroku.healthcheck);
        if (heroku.checkstring && heroku.checkstring !== res.body.toString()) {
          healthcheckFailed(heroku);
        }
        console.log(res.body.toString());
      } catch (err) {
        console.log(err.message);
        healthcheckFailed(heroku);
      }
    }

    core.setOutput(
      "status",
      "Successfully deployed heroku app from branch " + heroku.branch
    );
  } catch (err) {
    core.setFailed(err.toString());
  }
})();
