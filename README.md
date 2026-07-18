# カメラ翻訳

スマホのカメラに写したテキストを認識し、その場に翻訳を重ねてリアルタイム表示するARスタイルの翻訳アプリです。英語→日本語、日本語→英語の両方向に対応しています。

## 特徴

- カメラ映像から英語 or 日本語のテキストをリアルタイムOCR
- 画面上部のトグルボタンで「EN → 日本語」「日本語 → EN」を切り替え可能
- 翻訳先の読み手が読める言語でUI（案内文・ステータス表示・エラーメッセージ）も自動的に切り替わる
- 検出した位置に翻訳結果をホログラム風（氷白色の文字＋シアンの光暈）で重ねて表示（AR風オーバーレイ）
- 同じ文章は翻訳結果をキャッシュし、通信量と待ち時間を削減
- インストール不要のPWA（ホーム画面に追加可能）

## 技術スタック

- HTML5 / Canvas API
- WebRTC（`getUserMedia`によるカメラアクセス）
- [Tesseract.js](https://github.com/naptha/tesseract.js) 5.x（ブラウザ内OCR、WebAssembly）
- [DeepL API](https://www.deepl.com/en/pro-api)（英語⇄日本語翻訳、同梱の[api/translate.js](api/translate.js)経由）
- [MyMemory Translation API](https://mymemory.translated.net/)（DeepLが利用できない場合のフォールバック）
- Service Worker（PWA / オフラインでのアプリ起動）

## 使い方

1. [camera-translator.html](camera-translator.html) をスマホのブラウザで開く（**HTTPS配信が必須**。カメラAPIはセキュアコンテキストでのみ動作します）
2. 上部のトグルボタンで翻訳方向（「EN → 日本語」／「日本語 → EN」）を選ぶ
3. 「カメラ起動」（英語UI時は「Start Camera」）をタップし、カメラへのアクセスを許可する
4. 翻訳したい言語のテキスト（看板・メニュー・パッケージなど）にカメラを向ける
5. 認識したテキストの位置に翻訳結果が重ねて表示される
6. 「停止」（英語UI時は「Stop」）でカメラを終了

カメラ起動中でも翻訳方向トグルは切り替え可能。切り替え時はOCRエンジンを対象言語用に読み込み直すため、数秒間「言語を切り替え中…」の表示になる。

## 仕組み

1. 一定間隔（約1.2秒ごと）でカメラ映像の1フレームを縮小してキャプチャ
2. Tesseract.jsがブラウザ内（WebAssembly）で、選択中の言語（`eng`/`jpn`）のテキスト行と位置（バウンディングボックス）を検出
3. 信頼度が低い行やノイズ（対象言語の文字を含まない行など）は除外
4. 検出したテキストを[api/translate.js](api/translate.js)（DeepLキーを保持するVercel Serverless Function）に送信して翻訳を取得。失敗時はMyMemory APIにフォールバック（同一テキスト・同一方向の組はキャッシュから再利用）
5. 元のテキストがあった位置に翻訳結果をホログラム風（氷白色＋シアンの光暈、黒縁取りで視認性確保）でCanvas描画

## プライバシー・通信について

- OCR（文字認識）処理は端末内（ブラウザのWebAssembly）で完結し、映像そのものが外部に送信されることはありません
- ただし**認識されたテキスト**は翻訳のため`/api/translate`（自前のVercel Function）経由でDeepLに、あるいはフォールバック時はMyMemory API（`api.mymemory.translated.net`）にHTTPS経由で送信されます。看板やメモなど、認識対象のテキスト内容が第三者サービスを通過する点にご注意ください
- DeepL APIキーはブラウザには一切露出せず、Vercel側の環境変数としてのみ保持されます
- Tesseract.jsのOCRエンジン本体・言語データはCDN（`cdn.jsdelivr.net`）から読み込みます
- カメラ映像の録画・保存機能はありません

## ブラウザ要件

- カメラアクセスとWebAssemblyに対応したモダンブラウザ（Chrome、Safari最新版など）
- HTTPS（またはlocalhost）での配信が必須
- 推奨: 背面カメラ搭載のスマートフォン

## 制限事項

- OCR・翻訳ともに認識精度は完全ではありません（特に手書き文字や複雑な背景では精度が下がります）
- 日本語OCRは看板やパッケージの多様なフォント・縦書き・漢字/かな混在の影響で、英語より認識精度が下がる傾向があります
- DeepL APIは無料枠に上限があり、上限に達するとMyMemoryへ自動フォールバックします（訳質は下がります）
- 対応言語は英語⇄日本語のみです（他言語への対応は未実装）

## 翻訳プロキシ(api/translate.js)のセットアップ

DeepL APIキーをブラウザに露出させないため、`api/translate.js`をVercel Serverless Functionとしてデプロイして使う。

1. [Vercel](https://vercel.com/) にログイン（GitHubアカウントでOK）
2. 「Add New Project」→このリポジトリ（`zzzzico12/camera-translator`）をインポート
3. **Root Directory** はリポジトリ直下のまま（空欄でOK。以前はモノレポの`apps/camera-translator`を指定していたが、分離後は不要）
4. Environment Variables に以下を追加
   - Key: `DEEPL_API_KEY`
   - Value: 取得したDeepL APIキー（末尾が`:fx`なら無料/Developerプラン）
   - Environment: Production / Preview / Development すべてにチェック
5. Deployを実行
6. デプロイ完了後に発行されるURL（例: `https://camera-translator-xxxx.vercel.app`）を確認し、
   [camera-translator.html](camera-translator.html) 内の `TRANSLATE_PROXY_URL` をこのURLの `/api/translate` に更新する

既存のVercelプロジェクト（旧`zzzzico12/claude`リポジトリに接続していたもの）を使い回す場合は、
Vercelの Project Settings → Git → Connected Git Repository を`zzzzico12/camera-translator`に
繋ぎ直し、Root Directoryを空欄に変更するだけでよい。この場合`DEEPL_API_KEY`もドメインも
そのまま引き継がれるため、`TRANSLATE_PROXY_URL`の変更は不要。

現在のプロジェクトはこの方法で移行済み。Project Settings → General の Project Name は
`camera-translator`に変更したが、自動割り当てドメイン（`claude-pi-lilac.vercel.app`）は
プロジェクト名変更後も変わらず引き継がれた。なお、このドメインの`/`（ルート）に直接アクセスすると
404になるが、これは`index.html`が存在しないための想定内の挙動で、`/camera-translator.html`や
`/api/translate`は正常に動作する。

### ローカルでの確認（任意）

```
npm i -g vercel
vercel dev
```

### 注意

- DeepL APIキーは無料プランでも上限に達すると翻訳が失敗するようになっている（このプロキシは502を返し、クライアント側はMyMemoryにフォールバックする）
- キーを再発行した場合は、Vercelの環境変数を更新して再デプロイすること

---

Made with Claude
