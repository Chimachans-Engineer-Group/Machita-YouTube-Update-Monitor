function monitorSchedule() {
  const videoId = "0MI5RFT38Ts";
  const imageUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  const folderId = PropertiesService.getScriptProperties().getProperty("FOLDER_ID");
  const folder = DriveApp.getFolderById(folderId);
  const fileToCompareNum = 2;

  // フォルダ内のファイルをすべて取得
  const files = [];
  const fileIterator = folder.getFiles();
  while (fileIterator.hasNext()) {
    files.push(fileIterator.next());
  }
  // 作成日時で昇順にソート
  files.sort((a, b) => a.getDateCreated() - b.getDateCreated());

  // UrlFetchAppで画像URLにリクエストし、画像ファイルを取得
  const currentBlob = UrlFetchApp.fetch(imageUrl).getBlob();

  // 現在のバイナリデータを取得
  const currentBinary = currentBlob.getDataAsString();
  // 過去のデータが
  if (files.length) {
    // 記録されているとき、過去のバイナリデータを取得
    const prevBinaries = files.slice(-fileToCompareNum).map((file) => {
      const fileId = file.getId();
      return DriveApp.getFileById(fileId).getBlob().getDataAsString();
    });
    // スケジュールが
    if (prevBinaries.includes(currentBinary)) {
      // 更新されていないとき
      console.log("前回と同じ画像なので終了");
      return;
    } else {
      // 更新されているとき
      console.log("スケジュールが更新された！");
    }
  } else {
    // 記録されていないとき
    console.log("過去のデータが記録されていない");
  }

  // GoogleDriveに取得した画像を保存
  const newFile = folder.createFile(currentBlob);
  newFile.setName(currentDate + ".jpg");
  const newFileId = newFile.getId();
  console.log("newFileId: " + newFileId);

  // 古い画像が
  while (files.length >= fileToCompareNum) {
    // 存在するとき、削除する
    const oldFile = files.shift();
    Drive.Files.remove(oldFile.getId());
  }

  // ポストする
  const postText = `スケジュールが更新されました https://www.youtube.com/live/${videoId}`;
  sendPost(postText);
}
