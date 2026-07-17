# カメラ翻訳

スマホのカメラに写した英語のテキストを認識し、その場に日本語訳を重ねてリアルタイム表示するARスタイルの翻訳アプリです。

## 特徴

- カメラ映像から英語テキストをリアルタイムOCR
- 検出した位置に日本語訳を重ねて表示（AR風オーバーレイ）
- 同じ文章は翻訳結果をキャッシュし、通信量と待ち時間を削減
- インストール不要のPWA（ホーム画面に追加可能）

## 技術スタック

- HTML5 / Canvas API
- WebRTC（`getUserMedia`によるカメラアクセス）
- [Tesseract.js](https://github.com/naptha/tesseract.js) 5.x（ブラウザ内OCR、WebAssembly）
- [DeepL API](https://www.deepl.com/en/pro-api)（英語→日本語翻訳、同梱の[api/translate.js](api/translate.js)経由）
- [MyMemory Translation API](https://mymemory.translated.net/)（DeepLが利用できない場合のフォールバック）
- Service Worker（PWA / オフラインでのアプリ起動）

## 使い方

1. [camera-translator.html](camera-translator.html) をスマホのブラウザで開く（**HTTPS配信が必須**。カメラAPIはセキュアコンテキストでのみ動作します）
2. 「カメラ起動」をタップし、カメラへのアクセスを許可する
3. 英語のテキスト（看板・メニュー・パッケージなど）にカメラを向ける
4. 認識したテキストの位置に日本語訳が重ねて表示される
5. 「停止」でカメラを終了

## 仕組み

1. 一定間隔（約1.2秒ごと）でカメラ映像の1フレームを縮小してキャプチャ
2. Tesseract.jsがブラウザ内（WebAssembly）でテキスト行と位置（バウンディングボックス）を検出
3. 信頼度が低い行やノイズ（英字を含まない行など）は除外
4. 検出したテキストを[api/translate.js](api/translate.js)（DeepLキーを保持するVercel Serverless Function）に送信して日本語訳を取得。失敗時はMyMemory APIにフォールバック（同一テキストはキャッシュから再利用）
5. 元のテキストがあった位置に日本語訳を縁取り文字でCanvas描画（背景ボックスなし、映像に溶け込ませる）

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
- DeepL APIは無料枠に上限があり、上限に達するとMyMemoryへ自動フォールバックします（訳質は下がります）
- 対応言語は英語→日本語のみです

## 翻訳プロキシ(api/translate.js)のセットアップ

DeepL APIキーをブラウザに露出させないため、`api/translate.js`をVercel Serverless Functionとしてデプロイして使う。

1. [Vercel](https://vercel.com/) にログイン（GitHubアカウントでOK）
2. 「Add New Project」→このリポジトリ（`zzzzico12/claude`）をインポート
3. **Root Directory** に `apps/camera-translator` を指定
4. Environment Variables に以下を追加
   - Key: `DEEPL_API_KEY`
   - Value: 取得したDeepL APIキー（末尾が`:fx`なら無料/Developerプラン）
   - Environment: Production / Preview / Development すべてにチェック
5. Deployを実行
6. デプロイ完了後に発行されるURL（例: `https://camera-translator-xxxx.vercel.app`）を確認し、
   [camera-translator.html](camera-translator.html) 内の `TRANSLATE_PROXY_URL` をこのURLの `/api/translate` に更新する

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
