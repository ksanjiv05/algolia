var express = require("express");
const algoliasearch = require("algoliasearch");
const bodyParser = require("body-parser");
const striptags = require("striptags");
const axios = require("axios").default;
const rp = require("request-promise-native");
const cors = require("cors");
var app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());

// parse application/json
app.use(bodyParser.json());
var port = process.env.PORT || 3001
const client = algoliasearch("1BG45YLJO5", "38a1d2a23ed5658bd4e874e45074a2ce");

function confluenceGet(obj) {
  return rp({
    url: obj.host + "/rest/api/content",
    // GET parameters
    qs: {
      limit: 20, // number of item per page
      orderBy: "history.lastUpdated", // sort them by last updated
      expand: [
        // fields to retrieve
        "history.lastUpdated",
        "ancestors.page",
        "descendants.page",
        "body.view",
        "space",
      ].join(","),
    },
    headers: {
      // auth headers
      Authorization: `Basic ${Buffer.from(
        `${obj.username}:${obj.password}`
      ).toString("base64")}`,
    },
    json: true,
  });
}

function parseDocuments(documents, obj) {
  const buildURL = (uri) =>
    uri ? obj.host + uri.replace(/^\/wiki/, "") : false;

  const parseContent = (html) =>
    html
      ? striptags(html)
          .replace(/(\r\n?)+/g, " ")
          .replace(/\s+/g, " ")
      : "";

  return documents.map((doc) => ({
    objectID: doc.id,
    name: doc.title,
    url: buildURL(doc._links.webui),
    space: doc.space.name,
    spaceMeta: {
      id: doc.space.id,
      key: doc.space.key,
      url: buildURL(doc.space._links.webui),
    },
    lastUpdatedAt: doc.history.lastUpdated.when,
    lastUpdatedBy: doc.history.lastUpdated.by.displayName,
    lastUpdatedByPicture: buildURL(
      doc.history.lastUpdated.by.profilePicture.path.replace(
        /(\?[^\?]*)?$/,
        "?s=200"
      )
    ),
    createdAt: doc.history.createdDate,
    createdBy: doc.history.createdBy.displayName,
    createdByPicture: buildURL(
      doc.history.createdBy.profilePicture.path.replace(
        /(\?[^\?]*)?$/,
        "?s=200"
      )
    ),
    path: doc.ancestors.map(({ title }) => title).join(" › "),
    level: doc.ancestors.length,
    ancestors: doc.ancestors.map(({ id, title, _links }) => ({
      id: id,
      name: title,
      url: buildURL(_links.webui),
    })),
    children: doc.descendants
      ? doc.descendants.page.results.map(({ id, title, _links }) => ({
          id: id,
          name: title,
          url: buildURL(_links.webui),
        }))
      : [],
    content: parseContent(doc.body.view.value),
  }));
}

app.post("/", function (req, res) {
  console.log(req);
  res.send("res");
});
app.post("/c", async function (req, res) {
  try {
    const index = client.initIndex("demoConfluence");
    if (
      req.body.host == null ||
      req.body.username == null ||
      req.body.password == null
    ) {
      return res.status(401).json({ message: "Unauthorized Error" });
    }
    const obj = {
      host: req.body.host,
      username: req.body.username,
      password: req.body.password,
    };
    const saveObjects = () =>
      confluenceGet(obj)
        .then(({ results, _links }) => {
          index
            .saveObjects(parseDocuments(results, obj))
            .then((res) => {
              if (_links.next) saveObjects(_links.next);
            })
            .catch();
        })
        .catch();
    saveObjects();
    return res.status(200).json("done");
  } catch (error) {
    return res
      .status(error.statusCode || 401)
      .json({ message: "Unauthorized Error" });
  }
});
app.post("/g", async function (req, res) {
  console.log("req.body.access_token", req.body.access_token);
  const options = {
    method: "GET",
    url: "https://www.googleapis.com/drive/v3/files",
    headers: {
      Accept: "application/json",
      Authorization: "Bearer " + req.body.access_token,
    },
  };
  await axios(options)
    .then((responce) => {
      console.log("success");
      pushData(responce.data.files);
      return res.status(200).json({ message: "success" });
    })
    .catch((err) => {
      return res
        .status(err.statusCode || 401)
        .json({ message: "Unauthorized Error" });
    });
});

async function pushData(records) {
  const index = client.initIndex("Newdemo");
  records.map((record) => {
    record.objectID = record.id;
    //need to change
    record.image =
      "https://cdn4.iconfinder.com/data/icons/free-colorful-icons/360/google_docs.png";
  });
  for (var i = 0; i < records.length; i++) {
    var r = [];
    r.push(records[i]);
    return index
      .saveObjects(r)
      .then(({ objectIDs }) => {
        return objectIDs;
      })
      .catch((e) => console.log(e));
  }
}
app.get("/a", async function (req, res) {
  if (
    req.body.host == null ||
    req.body.username == null ||
    req.body.password == null
  ) {
    return res.status(401).json({ message: "Unauthorized Error" });
  }
  const obj = {
    host: req.body.host,
    username: req.body.username,
    password: req.body.password,
  };
  await rp({
    url: obj.host + "/rest/api/content",
    qs: {
      limit: 20,
      orderBy: "history.lastUpdated",
      expand: [
        "history.lastUpdated",
        "ancestors.page",
        "descendants.page",
        "body.view",
        "space",
      ].join(","),
    },
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${obj.username}:${obj.password}`
      ).toString("base64")}`,
    },
    json: true,
  })
    .then((responce) => {
      console.log("success");
      return res.status(200).json({ message: "success" });
    })
    .catch((err) => {
      return res
        .status(err.statusCode || 401)
        .json({ message: "Unauthorized Error" });
    });
});

app.post('/auth', async function(req, res){
  // Retrieve Jira projects
  console.log('i am auth');
  const url = req.body.url;
  const username = req.body.username;
  const password = req.body.password;
  console.log(req.body);
  const options = {
    method: "GET",
    url: url + "/rest/api/3/project",
    auth: { username: username, password: password },
    headers: { Accept: "application/json" },
  };
  const result = await axios(options)
    .then(function (responce) {
      console.log("success");
      console.log(responce.status);
      //after auth user need to check if webhook is avalilable aginest user
      checkWebhook(url, username, password);
      return res.status(200).json({ greeting: "success" });
      //return 'success'
    })
    .catch(function (err) {
      //console.log(err);
      return res.status(422).json({ greeting: "error" });
      //return 'error'
    });
}
);


const createWebhook = async (url, username, password) => {
  console.log("create web -" + username);
  const data = {
    name: "This is default webhook ",
    url: "https://nameless-cove-12952.herokuapp.com/api/jira/addIsuue",
    events: ["jira:issue_created", "jira:issue_updated"],
    jqlFilter: "Project = JRA AND resolution = Fixed",
    excludeIssueDetails: false,
  };

  const options = {
    method: "post",
    url: url + "/rest/webhooks/1.0/webhook",
    auth: { username: username, password: password },

    headers: { Accept: "application/json" },
    data: data,
  };
  const result = await axios(options)
    .then(function (responce) {
      console.log("success");
      console.log(responce.status);
    })
    .catch(function (err) {
      console.log("reere");
    });
};



checkWebhook = async (url, username, password) => {
  console.log("check web ---------------------- " + url);
  const options = {
    method: "get",
    url: url + "/rest/webhooks/1.0/webhook",
    auth: { username: username, password: password },

    headers: { Accept: "application/json" },
  };
  const result = await axios(options)
    .then(function (responce) {
      console.log("success");
      console.log(responce.status);
      console.log(responce.data.length);
      console.log(responce.data);
      const webhooks = responce.data;
      let flag = false;
      webhooks.map((hook) => {
        if (
          hook.url === "https://nameless-cove-12952.herokuapp.com/addIsuue"
        ) {
          console.log(hook.url);
          flag = true;
        }
      });
      console.log(flag);
      if (flag) console.log("web hook created already..");
      else {
        console.log("need to create");
        createWebhook(url, username, password);
      }
    })
    .catch(function (err) {
      console.log("reere");
    });
};

//--------
app.post('addIsuue', (req,res) => {
    const projects = req.body;//JSON.parse(issuebody);
    const record={};
    record.IssueId=projects.issue.id;
    record.ProjectName=projects.issue.fields.project.name;
    record.Issue=projects.issue;
    record.Summary=projects.issue.fields.summary;
    record.Description=projects.issue.fields.description;
    record.Project=projects.issue.fields.project;
    record.objectID=projects.issue.id;
    
    const records =[record];
    indexData(index, records);
    // if (atomicFlag) {
    //   atomicallyReindexData(client, index, records);
    // }
    // else {
    //   indexData(index, records);
    // };
});

function indexData(index, data) {
  const index1 = client.initIndex("demoConfluence");
  index1.saveObjects(data);
  console.log(data);
}

app.listen(port, function () {
  console.log(`Example app listening on port ! ${port}`);
});
