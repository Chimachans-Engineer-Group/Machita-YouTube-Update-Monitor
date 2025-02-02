// 認証用の各種変数
const CLIENT_ID = PropertiesService.getScriptProperties().getProperty("CLIENT_ID");
const CLIENT_SECRET = PropertiesService.getScriptProperties().getProperty("CLIENT_SECRET");
const appName = "Machita-YouTube-Update-Monitor";

/**
 * メニューを構築する
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("OAuth認証")
    .addItem("認証の実行", "startOAuth")
    .addItem("テストポスト", "testPost")
    .addSeparator()
    .addItem("ログアウト", "logout")
    .addToUi();
}

/**
 * 認証を実行し、未認証の場合はユーザーを認証URLに誘導する
 */
function startOAuth() {
  //UIを取得する
  const ui = SpreadsheetApp.getUi();
  //認証済みかチェックする
  const service = getService_(appName);
  if (!service.hasAccess()) {
    // 未認証の場合は認証画面を出力
    const authorizationUrl = service.getAuthorizationUrl();
    const template = HtmlService.createTemplate(
      '<a href="<?= authorizationUrl ?>" target="_blank">アクセス承認</a>'
    );
    template.authorizationUrl = authorizationUrl;
    const page = template.evaluate();
    ui.showSidebar(page);
  } else {
    // 認証済みの場合は終了する
    ui.alert("すでに認証済みです。");
  }
}

/**
 * 認証チェック用関数
 * @param {string} serviceName 認証を確認したいサービスの名称
 * @returns {*} 作成されたOAuth2Serviceクラス
 */
function getService_(serviceName) {
  const userProps = PropertiesService.getUserProperties();

  createPKCECodes();

  return OAuth2.createService(serviceName)
    .setAuthorizationBaseUrl("https://twitter.com/i/oauth2/authorize")
    .setTokenUrl(
      "https://api.twitter.com/2/oauth2/token?code_verifier=" +
        userProps.getProperty("code_verifier")
    )
    .setClientId(CLIENT_ID)
    .setClientSecret(CLIENT_SECRET)
    .setCallbackFunction("authCallback")
    .setPropertyStore(userProps)
    .setScope("offline.access tweet.read tweet.write users.read")
    .setParam("response_type", "code")
    .setParam("code_challenge_method", "S256")
    .setParam("code_challenge", userProps.getProperty("code_challenge"))
    .setTokenHeaders({
      Authorization: "Basic " + Utilities.base64Encode(CLIENT_ID + ":" + CLIENT_SECRET),
      "Content-Type": "application/x-www-form-urlencoded",
    });
}

/**
 * 認証コールバック
 * @param {*} request
 * @returns {GoogleAppsScript.HTML.HtmlOutput} 認証結果メッセージを表示する
 */
function authCallback(request) {
  const service = getService_(request.parameter.serviceName);
  const isAuthorized = service.handleCallback(request);
  if (isAuthorized) {
    return HtmlService.createHtmlOutput("認証が正常に終了しました");
  } else {
    return HtmlService.createHtmlOutput("認証がキャンセルされました");
  }
}

/**
 * PKCEのcode2つを生成する
 */
function createPKCECodes() {
  var userProps = PropertiesService.getUserProperties();
  if (!userProps.getProperty("code_verifier")) {
    var verifier = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

    for (var i = 0; i < 128; i++) {
      verifier += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    var sha256Hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, verifier);

    var challenge = Utilities.base64Encode(sha256Hash)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    userProps.setProperty("code_verifier", verifier);
    userProps.setProperty("code_challenge", challenge);
  }
}

/**
 * ログアウトする
 */
function logout() {
  const service = getService_(appName);
  service.reset();
  SpreadsheetApp.getUi().alert("ログアウトしました。");
}

/**
 * ポストする
 * @param {string} text ポストする文章
 */
function sendPost(text) {
  //トークン確認
  const service = getService_(appName);
  if (!service.hasAccess()) {
    // 未認証の場合はエラーを出して終了
    throw new TypeError("認証が実行されていません。");
  }
  //message本文
  const message = { text };
  //リクエスト実行
  const endpoint = "https://api.twitter.com/2/tweets";
  const response = UrlFetchApp.fetch(endpoint, {
    method: "post",
    headers: {
      Authorization: "Bearer " + service.getAccessToken(),
    },
    muteHttpExceptions: true,
    payload: JSON.stringify(message),
    contentType: "application/json",
  });
  //リクエスト結果を取得する
  const result = JSON.parse(response.getContentText());
  //リクエスト結果を表示
  console.log(JSON.stringify(result, null, 2));
}

/**
 * テストポストする
 */
function testPost() {
  text = new Date() + "テスト";
  sendPost(text);
}
