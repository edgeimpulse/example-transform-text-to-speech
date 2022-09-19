# Text to speech transform block

This is a transformation block that adds words or short sentences to your Edge Impulse project.

## How to run (Edge Impulse)

1. You'll need a Google Cloud API key:
    * Enable the TTS API for your account: https://cloud.google.com/nodejs/docs/reference/text-to-speech/latest#before-you-begin
    * Create an API Key: https://cloud.google.com/docs/authentication/api-keys

2. Add the API key as a secret to your Edge Impulse organization:
    1. Go to your Edge Impulse organization.
    2. Click **Custom blocks > Transformation**
    3. Click **Add new secret**
    4. Set as name: `GOOGLE_CLOUD_TTS_API_KEY`, as value the API Key you created in step 1.

3. Create a new transformation block:

    ```
    $ edge-impulse-blocks init

    ? Choose a type of block Transformation block
    ? Choose an option Create a new block
    ? Enter the name of your block Google Cloud text-to-speech
    ? Enter the description of your block Use Google Cloud's TTS API to generate new keywords. Takes in --keyword, --label, --lang and --count
    ? What type of data does this block operate on? Standalone (runs the container, but no files / data items passed in)
    ? Which buckets do you want to mount into this block (will be mounted under /mnt/s3fs/BUCKET_NAME, you can change these mount points in the St
    udio)?
    ? Would you like to download and load the example repository? no
    ```

4. Push the block:

    ```
    $ edge-impulse-blocks push
    ```

5. Now, you can add data to your project via:

    1. Go to your Edge Impulse project.
    2. Select **Data sources > Add new data source**
    3. Select *Transformation block*, *Google Cloud text-to-speech*, and set your arguments, e.g.:

        ```
        --keyword "Hello world" --lang nl-NL,en-US --count 100 --label helloworld
        ```

    4. Run the data source, then remove the data source again.

## How to run locally

1. You'll need a Google Cloud API key:
    * Enable the TTS API for your account: https://cloud.google.com/nodejs/docs/reference/text-to-speech/latest#before-you-begin
    * Create an API Key: https://cloud.google.com/docs/authentication/api-keys

2. Create a file called `set-env.sh` and set:

    ```
    export EI_PROJECT_ID=12009
    export EI_PROJECT_API_KEY=ei_...
    export EI_API_ENDPOINT=https://studio.edgeimpulse.com
    export EI_INGESTION_HOST=edgeimpulse.com
    export GOOGLE_CLOUD_TTS_API_KEY=AI...
    ```

3. Then, source the environment variables and run the script:

    ```
    source set-env.sh
    node tts.js --keyword "Hello world" --lang nl-NL,en-US --count 10 --label helloworld
    ```

    You'll find your files in `out-wav/`.

4. Upload the files to your project via:

    ```
    edge-impulse-uploader --api-key $EI_PROJECT_API_KEY out-wav/*.wav
    ```
