var messages = require('../messages.json')
var debug = require('debug')('TEST')
var Github = require('github-api')
var request = require('request')
var tape = require('tape')

var github = new Github({
  auth: 'oauth',
  token: process.env['REPOROBOT_TOKEN']
})

var reqHeaders = {
  'User-Agent': 'request',
  'Authorization': 'token ' + process.env['REPOROBOT_TOKEN']
}

var fork = github.getRepo('reporobot', 'patchwork')
var upstream = github.getRepo('jlord', 'patchwork')
var baseURL = 'https://api.github.com/repos/'
var prnum

// Create a branch on RR's fork of Patchwork. Then create a file on that
// branch so that you can create a PR. Check to see if RR commented on that PR.
// Delete branch when finished (or have failed).

tape("Test wrong branch name", function(t) {

  createBranch()

  function createBranch() {
    debug("⬢ Creating branch")
    fork.branch('gh-pages', 'wrongbranch', function(err) {
      if (err) {
        t.error(err, "Error creating branch on RRs fork")
        return t.end()
      }
      setTimeout(createDiff(), 5000)
    })
  }

  function createDiff() {
    var options = {
      headers: reqHeaders,
      url: baseURL + "reporobot/patchwork/contents/test.md",
      json: true,
      body: {
        "path": "test.md",
        "branch": "wrongbranch",
        "message": "TEST",
        "content": "bXkgbmV3IGZpbGUgY29udGVudHM=",
        "committer": {
          "name": "reporobot",
          "email": "60ebe73fdad8ee59d45c@cloudmailin.net"
        }
      }
    }

    request.put(options, function(err, res, body) {
      debug("⬢ Creating diff")
      if (err) {
        t.error(err, "Error making new file on branch", body)
        return t.end()
      }
      // Give GitHub some time
      setTimeout(function() { makePR() }, 5000)
    })
  }

  function makePR() {
    debug("⬢ Creating PR")
    var pull = {
      title: "[TESTING] Wrong branch name",
      body: "Running a test on a PR with a wrong branch name",
      base: "gh-pages",
      head: "reporobot:" + "wrongbranch"
    }

    upstream.createPullRequest(pull, function(err, pr) {
      if (err) {
        t.error(err, "error creating PR")
        return t.end()
      }
      prnum = pr.number
      // Give RR time to respond to PR
      setTimeout(function() { fetchPR(res,body) }, 15000)

    })
  }

  function fetchPR() {
    debug("⬢ Fetching PR")
    var prURL = baseURL + 'jlord/patchwork/issues/' + prnum + '/comments'
    var options = { headers: reqHeaders, json: true, url: prURL }

    request(options, function(err, res, body) {
      if (err) {
        t.error(err, "error fetching PR")
        return t.end()
      }
      if (res.length === 0) {
        t.fail("No PR created")
        return t.end()
      }
      getComment(res,body)
    })
  }

  function getComment(res, body) {
    debug("⬢ Getting comment")
    if (body.length < 1) {
      t.fail("Less than one comment")
      return t.end()
    }
    var lastComment = body[body.length - 1]
    t.equal(lastComment.user.login, "reporobot")
    t.equal(lastComment.body, messages.antipattern_branch)
    t.end()
  }
})

tape("Test cleanup", function(t) {

  deleteViaBranch()

  function deleteViaBranch() {
    debug("⬢ Deleting branch")
    fork.deleteRef('heads/wrongbranch', function(err) {
      if (err && err.error != '422') {
        t.error(err, "Error deleting branch")
        return t.end()
      }
      debug("⬢ Branch deleted on RR fork.")
      t.end()
    })
  }
})
