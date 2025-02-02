function monitorUpcomingStreams() {
  const channelId = "UCo7TRj3cS-f_1D9ZDmuTsjw";
  const feedURL = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const xmlns = XmlService.getNamespace("http://www.w3.org/2005/Atom");
  const xmlns_yt = XmlService.getNamespace("http://www.youtube.com/xml/schemas/2015");
  const xmlns_media = XmlService.getNamespace("http://search.yahoo.com/mrss/");
  const lastRow = sheets.upcomingStreamsSheet.getLastRow();
  const dataRange = sheets.upcomingStreamsSheet.getRange(2, 1, lastRow - 1, 2);
  const data = dataRange.getValues();

  // スプレッドシートに記録されたvideoIdたちを取得
  const pastVideoIds = data.map((row) => row[0]);
  console.log("pastVideoIds:\n" + pastVideoIds);

  // feedからvideoIdたちを取得
  const xml = XmlService.parse(UrlFetchApp.fetch(feedURL).getContentText());
  const entries = xml.getRootElement().getChildren("entry", xmlns);
  const parsedVideoIds = entries.map((entry) => entry.getChildText("videoId", xmlns_yt)).reverse();
  console.log("parsedVideoIds:\n" + parsedVideoIds);

  // YouTube Data APIにリクエストするvideoIdたちを準備
  const videoIdsToFetch = Array.from(new Set(pastVideoIds.concat(parsedVideoIds)));
  console.log("videoIdsToFetch:\n" + videoIdsToFetch);

  // videoIdsToFetchの中身が
  if (videoIdsToFetch.length === 0) {
    // 0個のとき
    console.log("確認したいvideoがないので終了");
    return;
  }

  // YouTube Data APIでそれぞれの情報を取得
  const ytResponse = YouTube.Videos.list("snippet, liveStreamingDetails, status", {
    id: videoIdsToFetch,
    fields:
      "items(id, snippet(title, liveBroadcastContent), liveStreamingDetails(scheduledStartTime), status(uploadStatus))",
  });
  console.log("ytResponse:\n" + ytResponse);

  // YouTubeから受け取った情報を整形し保存
  const videosInfo = ytResponse.items.flatMap((videoInfo) => {
    const liveBroadcastContent = videoInfo.snippet.liveBroadcastContent;
    const scheduledStartTime =
      "liveStreamingDetails" in videoInfo
        ? Utilities.formatDate(
            new Date(videoInfo.liveStreamingDetails.scheduledStartTime),
            "JST",
            "yyyy-MM-dd HH:mm z"
          ).toString()
        : null;
    const uploadStatus = videoInfo.status.uploadStatus;
    // upcoming以外は省く
    if (liveBroadcastContent !== "upcoming") {
      return [];
    }
    return {
      id: videoInfo.id,
      title: videoInfo.snippet.title,
      scheduledStartTime,
      uploadStatus,
    };
  });
  console.log("videosInfo:\n" + JSON.stringify(videosInfo));

  // それぞれの情報が更新されているか確認し、ポストする
  videosInfo.forEach((videoInfo) => {
    const updateInfo = (() => {
      // 確認したいvideoIdが
      const indexOfVideoId = pastVideoIds.indexOf(videoInfo.id);
      if (indexOfVideoId === -1) {
        // 新しいもののとき
        return {
          detail: "new",
        };
      }
      // すでに記録されているとき、過去の時点での情報を取得
      const pastVideoRow = data[indexOfVideoId];
      // 配信開始予定時刻が
      if (pastVideoRow[2] !== videoInfo.scheduledStartTime) {
        // 更新されていないときはこのvideoIdを飛ばす
        return false;
      }
      // 更新されているとき
      return {
        detail: "time",
      };
    })();
    if (!updateInfo) return;
    console.log(`videoId: ${videoInfo.id}, updateInfo: ${updateInfo}`);
    // ポスト文を作成
    let postText = "";
    switch (updateInfo.detail) {
      case "new":
        switch (videoInfo.uploadStatus) {
          case "uploaded":
            postText += "ライブ配信";
            break;
          case "processed":
            postText += "プレミア公開";
            break;
        }
        postText += "の待機所が作成されました";
        break;
      case "time":
        postText += "開始予定日時が変更されました";
        break;
    }
    postText += "\n\n";
    postText += videoInfo.title + "\n";
    postText += "youtu.be/" + videoInfo.id + "\n";
    postText += "開始予定日時：" + videoInfo.scheduledStartTime;
    // ポストする
    console.log("postText: " + postText);
    sendPost(postText);
  });

  // シートに記録する
  const newData = videosInfo.map((v) => [v.id, v.scheduledStartTime]);
  dataRange.clearContent();
  sheets.upcomingStreamsSheet.getRange(2, 1, newData.length, 2).setValues(newData);
  console.log("シートを更新しました");
}
