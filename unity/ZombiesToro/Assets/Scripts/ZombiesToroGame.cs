using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class ZombiesToroGame : MonoBehaviour
{
    [Header("Gameplay")]
    public int maxLives = 3;
    public int zombiesPerWave = 3;
    public float zombieSpeed = 1.8f;
    public float zombieSpawnInterval = 1.2f;
    public int scorePerKill = 100;

    private class WaypointData
    {
        public string name;
        public int[] connections;
        public string textureName;
        public WaypointData(string n, int[] c, string t) { name = n; connections = c; textureName = t; }
    }

    private static readonly WaypointData[] ToroWaypoints =
    {
        new WaypointData("Plaza Mayor", new int[]{1, 2}, "toro_ayuntamiento"),
        new WaypointData("Colegiata Santa Maria", new int[]{0, 3, 4}, "toro_colegiata"),
        new WaypointData("Puerta del Reloj", new int[]{0, 4}, "toro_calle1"),
        new WaypointData("Mirador del Duero", new int[]{1}, "toro_puente"),
        new WaypointData("Calle Reina", new int[]{1, 2, 5}, "toro_calle1"),
        new WaypointData("Puerta de la Corredera", new int[]{4}, "toro_plaza_toros")
    };

    private int currentWaypoint;
    private int score;
    private int lives;
    private int wave;
    private int zombiesAlive;
    private int zombiesSpawnedThisWave;
    private bool waveComplete;
    private bool gameOver;
    private float nextSpawnTimer;
    private bool showIntro = true;

    private Camera cam;
    private Renderer bgRenderer;
    private Texture2D fallbackTex;
    private readonly List<Zombie> zombies = new List<Zombie>();
    private AudioSource audioSource;
    private AudioSource musicSource;
    private AudioClip shootSound;
    private AudioClip hitSound;
    private AudioClip deathSound;
    private AudioClip musicLoop;

    private GUIStyle hudStyle;
    private int hudStyleSize = -1;
    private GUIStyle titleStyle;
    private int titleStyleSize = -1;
    private Texture2D crosshairTex;

    private readonly List<GameObject> buildings = new List<GameObject>();
    private readonly List<GameObject> streetProps = new List<GameObject>();

    private class Zombie
    {
        public Transform transform;
        public float health;
        public float speed;
        public float targetX;
    }

    private void Awake()
    {
        cam = Camera.main;
        if (cam == null)
        {
            var go = new GameObject("Main Camera");
            cam = go.AddComponent<Camera>();
            go.tag = "MainCamera";
        }
        cam.clearFlags = CameraClearFlags.SolidColor;
        cam.backgroundColor = new Color(0.005f, 0.005f, 0.03f);
        cam.fieldOfView = 65f;
        cam.nearClipPlane = 0.1f;
        cam.farClipPlane = 100f;
        cam.transform.position = new Vector3(0f, 1.6f, -2f);
        cam.transform.LookAt(new Vector3(0f, 1.4f, 20f));
        cam.enabled = true;
    }

    private void Start()
    {
        BuildScene();
        ResetGame();
    }

    private void BuildScene()
    {
        var lightObj = new GameObject("Moon Light");
        var light = lightObj.AddComponent<Light>();
        light.type = LightType.Directional;
        light.intensity = 0.5f;
        light.color = new Color(0.4f, 0.5f, 0.7f);
        lightObj.transform.rotation = Quaternion.Euler(35f, -40f, 0f);

        var ambient = new GameObject("Street Light");
        var alight = ambient.AddComponent<Light>();
        alight.type = LightType.Point;
        alight.intensity = 1.2f;
        alight.range = 15f;
        alight.color = new Color(1f, 0.7f, 0.3f);
        ambient.transform.position = new Vector3(0f, 4f, 10f);

        var bgObj = GameObject.CreatePrimitive(PrimitiveType.Quad);
        bgObj.name = "Background Photo";
        bgObj.transform.position = new Vector3(0f, 1.8f, 28f);
        bgObj.transform.localScale = new Vector3(30f, 16f, 1f);
        bgObj.transform.rotation = Quaternion.Euler(0f, 180f, 0f);
        bgRenderer = bgObj.GetComponent<Renderer>();
        var bgMat = new Material(Shader.Find("Unlit/Texture"));
        bgRenderer.material = bgMat;

        fallbackTex = new Texture2D(64, 64);
        for (int y = 0; y < 64; y++)
            for (int x = 0; x < 64; x++)
                fallbackTex.SetPixel(x, y, Random.value > 0.95f ? new Color(1f, 0.8f, 0.4f) : new Color(0.02f, 0.01f, 0.04f));
        fallbackTex.Apply();
        bgMat.mainTexture = fallbackTex;

        BuildRoad();
        BuildBuildings();
        BuildStreetProps();

        audioSource = gameObject.AddComponent<AudioSource>();
        audioSource.playOnAwake = false;
        shootSound = CreateTone("Shoot", 880f, 0.08f, true);
        hitSound = CreateTone("Hit", 220f, 0.2f, true);
        deathSound = CreateTone("Death", 120f, 0.5f, true);
        musicSource = gameObject.AddComponent<AudioSource>();
        musicSource.playOnAwake = false;
        musicSource.loop = true;
        musicSource.volume = 0.35f;
        musicSource.spatialBlend = 0f;
        BuildMusic();
        musicSource.clip = musicLoop;
        musicSource.Play();

        crosshairTex = new Texture2D(20, 20);
        for (int y = 0; y < 20; y++)
            for (int x = 0; x < 20; x++)
            {
                bool h = (x >= 8 && x <= 11) && (y <= 6 || y >= 13);
                bool v = (y >= 8 && y <= 11) && (x <= 6 || x >= 13);
                bool dot = (x >= 9 && x <= 10) && (y >= 9 && y <= 10);
                crosshairTex.SetPixel(x, y, (h || v || dot) ? Color.white : Color.clear);
            }
        crosshairTex.Apply();
    }

    private void BuildRoad()
    {
        var road = GameObject.CreatePrimitive(PrimitiveType.Cube);
        road.name = "Road";
        road.transform.position = new Vector3(0f, -0.05f, 8f);
        road.transform.localScale = new Vector3(6f, 0.1f, 30f);
        var rmat = new Material(Shader.Find("Sprites/Default"));
        rmat.color = new Color(0.06f, 0.06f, 0.08f);
        road.GetComponent<Renderer>().material = rmat;
        streetProps.Add(road);

        for (float z = -2f; z < 22f; z += 2.5f)
        {
            var dash = GameObject.CreatePrimitive(PrimitiveType.Cube);
            dash.name = "Road Dash";
            dash.transform.position = new Vector3(0f, 0.01f, z);
            dash.transform.localScale = new Vector3(0.6f, 0.02f, 0.9f);
            var dmat = new Material(Shader.Find("Sprites/Default"));
            dmat.color = new Color(0.25f, 0.25f, 0.2f);
            dash.GetComponent<Renderer>().material = dmat;
            streetProps.Add(dash);
        }

        var smat = new Material(Shader.Find("Sprites/Default"));
        smat.color = new Color(0.12f, 0.12f, 0.14f);
        var sidewalkL = GameObject.CreatePrimitive(PrimitiveType.Cube);
        sidewalkL.name = "Sidewalk Left";
        sidewalkL.transform.position = new Vector3(-3.5f, 0.05f, 8f);
        sidewalkL.transform.localScale = new Vector3(0.8f, 0.08f, 30f);
        sidewalkL.GetComponent<Renderer>().material = smat;
        streetProps.Add(sidewalkL);

        var sidewalkR = GameObject.CreatePrimitive(PrimitiveType.Cube);
        sidewalkR.name = "Sidewalk Right";
        sidewalkR.transform.position = new Vector3(3.5f, 0.05f, 8f);
        sidewalkR.transform.localScale = new Vector3(0.8f, 0.08f, 30f);
        sidewalkR.GetComponent<Renderer>().material = smat;
        streetProps.Add(sidewalkR);
    }

    private void BuildBuildings()
    {
        System.Random rng = new System.Random(42);
        Color[] wallColors = {
            new Color(0.12f, 0.10f, 0.08f), new Color(0.15f, 0.12f, 0.10f),
            new Color(0.10f, 0.12f, 0.14f), new Color(0.14f, 0.10f, 0.12f),
            new Color(0.08f, 0.10f, 0.10f),
        };
        Color windowOn = new Color(1f, 0.8f, 0.4f);
        Color windowOff = new Color(0.02f, 0.02f, 0.03f);

        for (int side = -1; side <= 1; side += 2)
            for (int b = 0; b < 6; b++)
            {
                float zPos = b * 3.8f + 1f;
                float width = (float)rng.NextDouble() * 1.8f + 1.5f;
                float height = (float)rng.NextDouble() * 2.5f + 2.5f;
                float depth = (float)rng.NextDouble() * 1.5f + 1.0f;
                float xOff = side * (4.2f + (float)rng.NextDouble() * 0.8f);

                var building = GameObject.CreatePrimitive(PrimitiveType.Cube);
                building.name = $"Building {side} {b}";
                building.transform.position = new Vector3(xOff, height * 0.5f, zPos);
                building.transform.localScale = new Vector3(width, height, depth);
                building.GetComponent<Renderer>().material = MakeMat(wallColors[b % wallColors.Length]);
                buildings.Add(building);

                int winCols = Mathf.FloorToInt(width / 0.5f);
                int winRows = Mathf.FloorToInt(height / 0.7f);
                for (int wy = 0; wy < winRows; wy++)
                    for (int wx = 0; wx < winCols; wx++)
                    {
                        if ((float)rng.NextDouble() > 0.65f) continue;
                        var win = GameObject.CreatePrimitive(PrimitiveType.Quad);
                        win.name = "Window";
                        float winX = -width * 0.5f + 0.3f + wx * 0.5f;
                        float winY = -height * 0.5f + 0.4f + wy * 0.7f;
                        float winZ = depth * 0.5f + 0.01f;
                        win.transform.position = new Vector3(xOff + winX, winY + 0.2f, zPos + winZ * side);
                        win.transform.localScale = new Vector3(0.3f, 0.4f, 1f);
                        win.transform.rotation = Quaternion.Euler(0, side == -1 ? -90 : 90, 0);
                        var wmat = new Material(Shader.Find("Sprites/Default"));
                        wmat.color = (float)rng.NextDouble() > 0.4f ? windowOn : windowOff;
                        if (wmat.color == windowOn) wmat.color *= new Color(1f, 1f, 1f, 0.7f);
                        win.GetComponent<Renderer>().material = wmat;
                        buildings.Add(win);
                    }

                if ((float)rng.NextDouble() > 0.5f)
                {
                    var roof = GameObject.CreatePrimitive(PrimitiveType.Cube);
                    roof.name = "Roof Detail";
                    roof.transform.position = new Vector3(xOff, height + 0.2f, zPos);
                    roof.transform.localScale = new Vector3(width * 1.08f, 0.15f, depth * 1.08f);
                    roof.GetComponent<Renderer>().material = MakeMat(new Color(0.06f, 0.06f, 0.07f));
                    buildings.Add(roof);
                }
            }
    }

    private Material MakeMat(Color c)
    {
        var m = new Material(Shader.Find("Sprites/Default"));
        m.color = c;
        return m;
    }

    private void BuildStreetProps()
    {
        for (float z = 1f; z < 20f; z += 4f)
        {
            for (int side = -1; side <= 1; side += 2)
            {
                var post = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                post.name = $"Light Post {side}";
                post.transform.position = new Vector3(side * 3.8f, 1.5f, z);
                post.transform.localScale = new Vector3(0.06f, 1.5f, 0.06f);
                var pmat = new Material(Shader.Find("Sprites/Default"));
                pmat.color = new Color(0.15f, 0.15f, 0.15f);
                post.GetComponent<Renderer>().material = pmat;
                streetProps.Add(post);

                var glow = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                glow.name = $"Lamp {side}";
                glow.transform.position = new Vector3(side * 3.8f, 3f, z);
                glow.transform.localScale = Vector3.one * 0.2f;
                var gmat = new Material(Shader.Find("Sprites/Default"));
                gmat.color = new Color(1f, 0.7f, 0.3f);
                glow.GetComponent<Renderer>().material = gmat;
                streetProps.Add(glow);
            }
        }
    }

    private void ResetGame()
    {
        currentWaypoint = 0;
        score = 0;
        lives = maxLives;
        wave = 0;
        gameOver = false;
        waveComplete = true;
        zombiesSpawnedThisWave = 0;
        showIntro = true;
        ClearZombies();
        LoadWaypointImage(0);
        StartNextWave();
    }

    private void LoadWaypointImage(int index)
    {
        var wp = ToroWaypoints[index];
        var tex = Resources.Load<Texture2D>($"Textures/{wp.textureName}");
        if (tex != null)
        {
            bgRenderer.material.mainTexture = tex;
            bgRenderer.material.color = Color.white;
        }
        else
        {
            bgRenderer.material.mainTexture = fallbackTex;
        }
    }

    private void StartNextWave()
    {
        wave++;
        zombiesAlive = 0;
        zombiesSpawnedThisWave = 0;
        waveComplete = false;
        nextSpawnTimer = 1.5f;
    }

    private static readonly Color32[] skinTones = new Color32[]
    {
        new Color32(89, 104, 76, 255),
        new Color32(109, 118, 86, 255),
        new Color32(130, 120, 90, 255),
        new Color32(110, 90, 75, 255),
        new Color32(95, 108, 82, 255),
    };

    private static readonly Color32[] shirtColors = new Color32[]
    {
        new Color32(60, 50, 45, 255),
        new Color32(45, 55, 50, 255),
        new Color32(80, 40, 35, 255),
        new Color32(50, 60, 70, 255),
        new Color32(100, 80, 50, 255),
    };

    private void SpawnZombie()
    {
        float side = Random.value > 0.5f ? -1f : 1f;
        float spawnX = side * Random.Range(4.5f, 7f);
        float spawnZ = Random.Range(3f, 8f);

        Color32 skinColor = skinTones[Random.Range(0, skinTones.Length)];
        Color32 shirtColor = shirtColors[Random.Range(0, shirtColors.Length)];

        var root = new GameObject("Zombie");
        root.transform.position = new Vector3(spawnX, 0f, spawnZ);

        var skinMat = new Material(Shader.Find("Standard"));
        skinMat.color = skinColor;
        skinMat.SetFloat("_Glossiness", 0.1f);

        var shirtMat = new Material(Shader.Find("Standard"));
        shirtMat.color = shirtColor;
        shirtMat.SetFloat("_Glossiness", 0.05f);

        var pantsMat = new Material(Shader.Find("Standard"));
        pantsMat.color = new Color32(35, 35, 40, 255);
        pantsMat.SetFloat("_Glossiness", 0.05f);

        var bloodMat = new Material(Shader.Find("Standard"));
        bloodMat.color = new Color32(80, 10, 10, 255);
        bloodMat.SetFloat("_Glossiness", 0.3f);

        var eyeWhiteMat = new Material(Shader.Find("Standard"));
        eyeWhiteMat.color = new Color32(220, 210, 200, 255);

        var eyePupilMat = new Material(Shader.Find("Standard"));
        eyePupilMat.color = new Color32(120, 10, 10, 255);

        var teethMat = new Material(Shader.Find("Standard"));
        teethMat.color = new Color32(200, 190, 160, 255);

        var hairColor = new Color32((byte)Random.Range(20, 60), (byte)Random.Range(15, 45), (byte)Random.Range(10, 30), 255);
        var hairMat = new Material(Shader.Find("Standard"));
        hairMat.color = hairColor;
        hairMat.SetFloat("_Glossiness", 0.4f);

        var torso = GameObject.CreatePrimitive(PrimitiveType.Cube);
        torso.name = "Torso";
        torso.transform.SetParent(root.transform, false);
        torso.transform.localPosition = new Vector3(0f, 1.05f, 0f);
        torso.transform.localScale = new Vector3(0.55f, 0.7f, 0.3f);
        torso.GetComponent<Renderer>().material = shirtMat;
        Destroy(torso.GetComponent<Collider>());

        var chest = GameObject.CreatePrimitive(PrimitiveType.Cube);
        chest.name = "Chest";
        chest.transform.SetParent(root.transform, false);
        chest.transform.localPosition = new Vector3(0f, 1.25f, -0.05f);
        chest.transform.localScale = new Vector3(0.5f, 0.25f, 0.35f);
        chest.GetComponent<Renderer>().material = skinMat;
        Destroy(chest.GetComponent<Collider>());

        var hip = GameObject.CreatePrimitive(PrimitiveType.Cube);
        hip.name = "Hip";
        hip.transform.SetParent(root.transform, false);
        hip.transform.localPosition = new Vector3(0f, 0.62f, 0f);
        hip.transform.localScale = new Vector3(0.5f, 0.2f, 0.28f);
        hip.GetComponent<Renderer>().material = pantsMat;
        Destroy(hip.GetComponent<Collider>());

        var head = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        head.name = "Head";
        head.transform.SetParent(root.transform, false);
        head.transform.localPosition = new Vector3(0f, 1.6f, 0f);
        head.transform.localScale = new Vector3(0.38f, 0.42f, 0.38f);
        head.GetComponent<Renderer>().material = skinMat;
        Destroy(head.GetComponent<Collider>());

        var jaw = GameObject.CreatePrimitive(PrimitiveType.Cube);
        jaw.name = "Jaw";
        jaw.transform.SetParent(root.transform, false);
        jaw.transform.localPosition = new Vector3(0f, 1.42f, -0.1f);
        jaw.transform.localScale = new Vector3(0.28f, 0.12f, 0.18f);
        jaw.GetComponent<Renderer>().material = skinMat;
        Destroy(jaw.GetComponent<Collider>());

        var hair = GameObject.CreatePrimitive(PrimitiveType.Cube);
        hair.name = "Hair";
        hair.transform.SetParent(root.transform, false);
        hair.transform.localPosition = new Vector3(0f, 1.82f, 0.02f);
        hair.transform.localScale = new Vector3(0.4f, 0.1f, 0.4f);
        hair.GetComponent<Renderer>().material = hairMat;
        Destroy(hair.GetComponent<Collider>());

        for (int i = -1; i <= 1; i += 2)
        {
            var eyeWhite = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            eyeWhite.name = "EyeWhite";
            eyeWhite.transform.SetParent(root.transform, false);
            eyeWhite.transform.localPosition = new Vector3(i * 0.09f, 1.62f, -0.17f);
            eyeWhite.transform.localScale = new Vector3(0.09f, 0.09f, 0.05f);
            eyeWhite.GetComponent<Renderer>().material = eyeWhiteMat;
            Destroy(eyeWhite.GetComponent<Collider>());

            var pupil = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            pupil.name = "Pupil";
            pupil.transform.SetParent(root.transform, false);
            pupil.transform.localPosition = new Vector3(i * 0.09f, 1.62f, -0.2f);
            pupil.transform.localScale = new Vector3(0.05f, 0.05f, 0.03f);
            pupil.GetComponent<Renderer>().material = eyePupilMat;
            Destroy(pupil.GetComponent<Collider>());
        }

        var mouth = GameObject.CreatePrimitive(PrimitiveType.Cube);
        mouth.name = "Mouth";
        mouth.transform.SetParent(root.transform, false);
        mouth.transform.localPosition = new Vector3(0f, 1.46f, -0.18f);
        mouth.transform.localScale = new Vector3(0.15f, 0.04f, 0.05f);
        mouth.GetComponent<Renderer>().material = teethMat;
        Destroy(mouth.GetComponent<Collider>());

        int woundCount = Random.Range(0, 3);
        for (int i = 0; i < woundCount; i++)
        {
            var wound = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            wound.name = "Wound";
            wound.transform.SetParent(root.transform, false);
            float wy = Random.Range(0.8f, 1.5f);
            float wz = -0.15f - Random.Range(0f, 0.1f);
            wound.transform.localPosition = new Vector3(Random.Range(-0.2f, 0.2f), wy, wz);
            wound.transform.localScale = new Vector3(0.08f, Random.Range(0.06f, 0.12f), 0.04f);
            wound.GetComponent<Renderer>().material = bloodMat;
            Destroy(wound.GetComponent<Collider>());
        }

        for (int i = -1; i <= 1; i += 2)
        {
            var upperArm = GameObject.CreatePrimitive(PrimitiveType.Cube);
            upperArm.name = "UpperArm";
            upperArm.transform.SetParent(root.transform, false);
            upperArm.transform.localPosition = new Vector3(i * 0.38f, 1.15f, 0f);
            upperArm.transform.localScale = new Vector3(0.12f, 0.4f, 0.12f);
            upperArm.GetComponent<Renderer>().material = shirtMat;
            Destroy(upperArm.GetComponent<Collider>());

            var forearm = GameObject.CreatePrimitive(PrimitiveType.Cube);
            forearm.name = "Forearm";
            forearm.transform.SetParent(root.transform, false);
            forearm.transform.localPosition = new Vector3(i * 0.4f, 0.82f, -0.08f);
            forearm.transform.localScale = new Vector3(0.1f, 0.35f, 0.1f);
            forearm.GetComponent<Renderer>().material = skinMat;
            Destroy(forearm.GetComponent<Collider>());

            var hand = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            hand.name = "Hand";
            hand.transform.SetParent(root.transform, false);
            hand.transform.localPosition = new Vector3(i * 0.41f, 0.62f, -0.12f);
            hand.transform.localScale = new Vector3(0.11f, 0.11f, 0.08f);
            hand.GetComponent<Renderer>().material = skinMat;
            Destroy(hand.GetComponent<Collider>());

            for (int f = 0; f < 3; f++)
            {
                var finger = GameObject.CreatePrimitive(PrimitiveType.Cube);
                finger.name = "Finger";
                finger.transform.SetParent(root.transform, false);
                finger.transform.localPosition = new Vector3(i * (0.38f + f * 0.025f), 0.58f - f * 0.03f, -0.16f);
                finger.transform.localScale = new Vector3(0.025f, 0.07f, 0.025f);
                finger.GetComponent<Renderer>().material = skinMat;
                Destroy(finger.GetComponent<Collider>());
            }
        }

        var kneeL = GameObject.CreatePrimitive(PrimitiveType.Cube);
        kneeL.name = "KneeL";
        kneeL.transform.SetParent(root.transform, false);
        kneeL.transform.localPosition = new Vector3(-0.13f, 0.5f, 0f);
        kneeL.transform.localScale = new Vector3(0.14f, 0.14f, 0.14f);
        kneeL.GetComponent<Renderer>().material = pantsMat;
        Destroy(kneeL.GetComponent<Collider>());

        var kneeR = GameObject.CreatePrimitive(PrimitiveType.Cube);
        kneeR.name = "KneeR";
        kneeR.transform.SetParent(root.transform, false);
        kneeR.transform.localPosition = new Vector3(0.13f, 0.5f, 0f);
        kneeR.transform.localScale = new Vector3(0.14f, 0.14f, 0.14f);
        kneeR.GetComponent<Renderer>().material = pantsMat;
        Destroy(kneeR.GetComponent<Collider>());

        for (int i = -1; i <= 1; i += 2)
        {
            var shin = GameObject.CreatePrimitive(PrimitiveType.Cube);
            shin.name = "Shin";
            shin.transform.SetParent(root.transform, false);
            shin.transform.localPosition = new Vector3(i * 0.13f, 0.28f, 0f);
            shin.transform.localScale = new Vector3(0.12f, 0.35f, 0.12f);
            shin.GetComponent<Renderer>().material = pantsMat;
            Destroy(shin.GetComponent<Collider>());

            var foot = GameObject.CreatePrimitive(PrimitiveType.Cube);
            foot.name = "Foot";
            foot.transform.SetParent(root.transform, false);
            foot.transform.localPosition = new Vector3(i * 0.13f, 0.06f, -0.06f);
            foot.transform.localScale = new Vector3(0.12f, 0.08f, 0.2f);
            foot.GetComponent<Renderer>().material = new Material(Shader.Find("Standard")) { color = new Color32(40, 35, 30, 255) };
            Destroy(foot.GetComponent<Collider>());
        }

        var collider = root.AddComponent<CapsuleCollider>();
        collider.center = new Vector3(0f, 1.0f, 0f);
        collider.radius = 0.3f;
        collider.height = 2.0f;

        float scale = Random.Range(0.9f, 1.2f);
        root.transform.localScale = Vector3.one * scale;

        float lean = Random.Range(-0.15f, 0.15f);
        root.transform.localRotation = Quaternion.Euler(0f, 0f, lean);

        zombies.Add(new Zombie
        {
            transform = root.transform,
            health = 1f,
            speed = zombieSpeed + Random.Range(-0.3f, 0.3f),
            targetX = Random.Range(-1f, 1f)
        });
        zombiesAlive++;
        zombiesSpawnedThisWave++;
    }

    private void Update()
    {
        if (gameOver)
        {
            if (Input.GetKeyDown(KeyCode.R) || Input.GetKeyDown(KeyCode.Return)) ResetGame();
            return;
        }

        if (showIntro)
        {
            if (Input.anyKeyDown) showIntro = false;
            return;
        }

        if (!waveComplete && zombiesSpawnedThisWave < zombiesPerWave + wave)
        {
            nextSpawnTimer -= Time.deltaTime;
            if (nextSpawnTimer <= 0f)
            {
                SpawnZombie();
                nextSpawnTimer = zombieSpawnInterval;
            }
        }

        MoveZombies();
        HandleShooting();

        if (!waveComplete && zombiesSpawnedThisWave >= zombiesPerWave + wave && zombiesAlive <= 0)
            waveComplete = true;
    }

    private void MoveZombies()
    {
        float time = Time.time;
        for (int i = zombies.Count - 1; i >= 0; i--)
        {
            var z = zombies[i];
            if (z.transform == null) { zombies.RemoveAt(i); continue; }

            Vector3 pos = z.transform.position;
            pos.z = Mathf.MoveTowards(pos.z, -0.5f, z.speed * Time.deltaTime);
            pos.x = Mathf.MoveTowards(pos.x, z.targetX, z.speed * 0.2f * Time.deltaTime);
            z.transform.position = pos;
            z.transform.LookAt(new Vector3(0f, 1.0f, -1f));

            float leanAngle = 8f + Mathf.Sin(time * 3f + i) * 5f;
            z.transform.localRotation = Quaternion.Euler(leanAngle, z.transform.localRotation.eulerAngles.y, Mathf.Sin(time * 4f + i * 0.5f) * 3f);

            foreach (Transform child in z.transform)
            {
                if (child.name == "UpperArm" || child.name == "Forearm" || child.name == "Hand")
                {
                    child.localPosition = new Vector3(child.localPosition.x, child.localPosition.y, Mathf.Lerp(child.localPosition.z, -0.2f, Time.deltaTime * 5f));
                }
                if (child.name == "Jaw")
                {
                    child.localScale = new Vector3(0.28f, 0.12f + Mathf.Abs(Mathf.Sin(time * 5f)) * 0.04f, 0.18f);
                }
                if (child.name == "Head")
                {
                    child.localRotation = Quaternion.Euler(Mathf.Sin(time * 2f + i) * 5f, 0f, 0f);
                }
            }

            if (pos.z <= -0.3f)
            {
                lives--;
                PlaySound(deathSound, 0.8f);
                Destroy(z.transform.gameObject);
                zombies.RemoveAt(i);
                zombiesAlive--;
                if (lives <= 0) gameOver = true;
            }
        }
    }

    private void HandleShooting()
    {
        bool shoot = Input.GetMouseButtonDown(0);
        if (Input.touchCount > 0 && Input.GetTouch(0).phase == TouchPhase.Began) shoot = true;
        if (!shoot) return;

        Ray ray = cam.ScreenPointToRay(Input.touchCount > 0 ? (Vector3)Input.GetTouch(0).position : Input.mousePosition);
        if (!Physics.Raycast(ray, out RaycastHit hit, 50f)) return;

        PlaySound(shootSound, 0.4f);

        foreach (var z in zombies)
        {
            if (z.transform == null) continue;
            Transform t = hit.transform;
            while (t != null)
            {
                if (t == z.transform)
                {
                    z.health -= 1f;
                    if (z.health <= 0f)
                    {
                        score += scorePerKill + wave * 10;
                        PlaySound(hitSound, 0.6f);
                        SpawnBloodEffect(z.transform.position + Vector3.up * 1.0f);
                        Destroy(z.transform.gameObject);
                        zombies.Remove(z);
                        zombiesAlive--;
                    }
                    else
                    {
                        SpawnBloodEffect(hit.point);
                        PlaySound(hitSound, 0.3f);
                    }
                    return;
                }
                t = t.parent;
            }
        }
    }

    private void SpawnBloodEffect(Vector3 pos)
    {
        for (int i = 0; i < 6; i++)
        {
            var p = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            p.name = "Blood";
            p.transform.position = pos + Random.insideUnitSphere * 0.2f;
            p.transform.localScale = Vector3.one * Random.Range(0.04f, 0.1f);
            var mat = new Material(Shader.Find("Standard"));
            mat.color = new Color32((byte)Random.Range(60, 120), 5, 5, 255);
            p.GetComponent<Renderer>().material = mat;
            Destroy(p.GetComponent<Collider>());
            StartCoroutine(FadeOut(p, Random.Range(0.3f, 0.8f)));
        }
    }

    private System.Collections.IEnumerator FadeOut(GameObject obj, float duration)
    {
        float elapsed = 0f;
        while (obj != null && elapsed < duration)
        {
            elapsed += Time.deltaTime;
            float t = elapsed / duration;
            obj.transform.localScale = Vector3.Lerp(obj.transform.localScale, Vector3.zero, t);
            if (obj != null) Destroy(obj);
            yield return null;
        }
    }

    private void ClearZombies()
    {
        foreach (var z in zombies) if (z.transform != null) Destroy(z.transform.gameObject);
        zombies.Clear();
        zombiesAlive = 0;
        zombiesSpawnedThisWave = 0;
    }

    public void MoveToWaypoint(int index)
    {
        if (index < 0 || index >= ToroWaypoints.Length || !waveComplete || gameOver) return;
        ClearZombies();
        currentWaypoint = index;
        waveComplete = true;
        LoadWaypointImage(index);
        StartNextWave();
    }

    private void OnGUI()
    {
        int hSize = Mathf.Clamp(Screen.width / 40, 16, 26);
        if (hudStyle == null || hudStyleSize != hSize)
        {
            hudStyle = new GUIStyle(GUI.skin.label) { fontSize = hSize, normal = { textColor = new Color(0.3f, 0.9f, 0.3f) } };
            hudStyleSize = hSize;
        }
        int tSize = Mathf.Clamp(Screen.width / 28, 22, 36);
        if (titleStyle == null || titleStyleSize != tSize)
        {
            titleStyle = new GUIStyle(GUI.skin.label) { fontSize = tSize, normal = { textColor = new Color(0.1f, 0.8f, 0.6f) }, fontStyle = FontStyle.Bold };
            titleStyleSize = tSize;
        }

        if (showIntro)
        {
            var bgStyle = new GUIStyle(GUI.skin.box) { normal = { background = Texture2D.whiteTexture } };
            GUI.Box(new Rect(0, 0, Screen.width, Screen.height), "", bgStyle);
            GUI.color = new Color(0f, 0f, 0f, 0.85f);
            GUI.DrawTexture(new Rect(0, 0, Screen.width, Screen.height), Texture2D.whiteTexture);
            GUI.color = Color.white;

            var titleS = new GUIStyle(titleStyle) { fontSize = Mathf.Clamp(Screen.width / 18, 30, 50), alignment = TextAnchor.MiddleCenter };
            GUI.Label(new Rect(0f, Screen.height * 0.12f, Screen.width, 60f), "ZOMBIES EN TORO", titleS);

            var subStyle = new GUIStyle(hudStyle) { fontSize = Mathf.Clamp(Screen.width / 30, 18, 24), alignment = TextAnchor.MiddleCenter };
            GUI.Label(new Rect(0f, Screen.height * 0.22f, Screen.width, 30f), "Sobrevive a las oleadas de zombis por las calles de Toro", subStyle);

            var btnStyle = new GUIStyle(GUI.skin.button) { fontSize = Mathf.Clamp(Screen.width / 28, 18, 26), fixedHeight = 50 };
            if (GUI.Button(new Rect(Screen.width * 0.5f - 120f, Screen.height * 0.45f, 240f, 50f), "EMPEZAR", btnStyle))
                showIntro = false;

            var ctrlStyle = new GUIStyle(hudStyle) { fontSize = Mathf.Clamp(Screen.width / 35, 16, 22), alignment = TextAnchor.UpperLeft, wordWrap = true };
            string controls = "CONTROLES:\n" +
                "🖱️ CLICK IZQUIERDO / TAP → Disparar\n" +
                "⬆️⬇️⬅️➡️  Flechas → Mover cámara (opcional)\n" +
                "🔘 Botones \"IR A...\" → Cambiar de calle al completar oleada\n" +
                "R / ENTER → Reiniciar al morir";
            GUI.Label(new Rect(Screen.width * 0.1f, Screen.height * 0.58f, Screen.width * 0.8f, 200f), controls, ctrlStyle);

            var hintStyle = new GUIStyle(hudStyle) { fontSize = 14, alignment = TextAnchor.MiddleCenter, normal = { textColor = new Color(0.6f, 0.6f, 0.6f) } };
            GUI.Label(new Rect(0f, Screen.height * 0.88f, Screen.width, 20f), "Pulsa cualquier tecla o pulsa EMPEZAR", hintStyle);

            return;
        }

        var wp = ToroWaypoints[currentWaypoint];
        GUI.Label(new Rect(20f, 12f, Screen.width - 40f, 40f), "ZOMBIES EN TORO", titleStyle);
        GUI.Label(new Rect(20f, 48f, Screen.width - 40f, 30f), $"PUNTUACION: {score}  VIDAS: {lives}  OLEADA: {wave}", hudStyle);
        GUI.Label(new Rect(20f, 76f, Screen.width - 40f, 24f), $"\u00B0 {wp.name}", hudStyle);

        GUI.Box(new Rect(20f, 104f, 202f, 20f), "");
        GUI.Box(new Rect(21f, 105f, 200f * ((float)lives / maxLives), 18f), "");
        GUI.Label(new Rect(25f, 103f, 200f, 20f), $"VIDAS: {lives}/{maxLives}", new GUIStyle(hudStyle) { fontSize = 12 });

        float cs = Mathf.Clamp(Screen.width * 0.025f, 14f, 28f);
        GUI.DrawTexture(new Rect(Screen.width * 0.5f - cs * 0.5f, Screen.height * 0.5f - cs * 0.5f, cs, cs), crosshairTex);

        if (!waveComplete)
        {
            if (zombiesAlive <= 0 && zombiesSpawnedThisWave < zombiesPerWave + wave)
                GUI.Label(new Rect(Screen.width * 0.5f - 100f, Screen.height * 0.3f, 200f, 30f), "PREPARATE...", new GUIStyle(hudStyle) { alignment = TextAnchor.MiddleCenter, fontSize = 22, normal = { textColor = Color.white } });
            else
                GUI.Label(new Rect(20f, 128f, 300f, 24f), $"ZOMBIES VIVOS: {zombiesAlive}", hudStyle);
        }

        if (waveComplete)
        {
            var readyStyle = new GUIStyle(GUI.skin.label) { fontSize = 22, alignment = TextAnchor.MiddleCenter, normal = { textColor = new Color(0.2f, 1f, 0.4f) } };
            GUI.Label(new Rect(0f, Screen.height * 0.28f, Screen.width, 30f), "OLEADA COMPLETADA", readyStyle);

            float btnW = Mathf.Clamp(Screen.width * 0.24f, 140f, 240f);
            float btnH = Mathf.Clamp(Screen.height * 0.06f, 40f, 55f);
            int conn = wp.connections.Length;
            if (conn == 0)
                GUI.Label(new Rect(0f, Screen.height * 0.36f, Screen.width, 30f), "No hay mas calles", hudStyle);
            else for (int i = 0; i < conn; i++)
            {
                var tw = ToroWaypoints[wp.connections[i]];
                float x = Screen.width * 0.5f - btnW * 0.5f;
                float y = Screen.height * 0.36f + i * (btnH + 8f);
                if (GUI.Button(new Rect(x, y, btnW, btnH), $"IR A  {tw.name}"))
                    MoveToWaypoint(wp.connections[i]);
            }
        }

        if (gameOver)
        {
            var msgStyle = new GUIStyle(GUI.skin.label) { fontSize = Mathf.Clamp(Screen.width / 20, 30, 50), alignment = TextAnchor.MiddleCenter, normal = { textColor = new Color(1f, 0.2f, 0.2f) } };
            GUI.Label(new Rect(0f, Screen.height * 0.22f, Screen.width, 100f), "GAME OVER", msgStyle);
            GUI.Label(new Rect(0f, Screen.height * 0.22f + 70f, Screen.width, 30f), $"Puntuacion final: {score}", new GUIStyle(hudStyle) { alignment = TextAnchor.MiddleCenter, fontSize = 20 });
            GUI.Label(new Rect(0f, Screen.height * 0.22f + 105f, Screen.width, 30f), "Pulsa R o ENTER para reiniciar", new GUIStyle(hudStyle) { alignment = TextAnchor.MiddleCenter });
        }
    }

    private void BuildMusic()
    {
        musicSource = gameObject.AddComponent<AudioSource>();
        musicSource.playOnAwake = false;
        musicSource.loop = true;
        musicSource.volume = 0.25f;

        const int sampleRate = 22050;
        float duration = 18f;
        int totalSamples = Mathf.CeilToInt(sampleRate * duration);
        var samples = new float[totalSamples];

        float[] bassNotes = { 65.41f, 73.42f, 82.41f, 98.0f, 110.0f, 130.81f };
        float[] melodyNotes = { 220f, 261.63f, 311.13f, 349.23f, 392f, 440f, 523.25f, 622.25f };
        int[] melodyPattern = { 0, 1, 3, 1, 4, 3, 1, 0, 2, 3, 5, 3, 1, 0, 1, 3, 6, 5, 3, 1, 0, 1, 3, 1, 4, 3, 1, 0, 2, 3, 5, 7, 6, 5, 3, 1 };

        int beatLength = sampleRate / 3;
        int melodyBeat = sampleRate / 6;

        for (int i = 0; i < totalSamples; i++)
        {
            float t = (float)i / sampleRate;

            int bassIdx = (i / (beatLength * 6)) % bassNotes.Length;
            float bassFreq = bassNotes[bassIdx];
            float bass = Mathf.Sin(2f * Mathf.PI * bassFreq * t) * 0.12f;
            bass += Mathf.Sin(2f * Mathf.PI * bassFreq * 0.5f * t) * 0.08f;

            int melIdx = (i / melodyBeat) % melodyPattern.Length;
            float melFreq = melodyNotes[melodyPattern[melIdx]];
            float melEnv = Mathf.Clamp01(1f - ((float)(i % melodyBeat) / melodyBeat) * 2f);
            float melody = Mathf.Sin(2f * Mathf.PI * melFreq * t) * 0.06f * melEnv;
            melody += Mathf.Sin(2f * Mathf.PI * melFreq * 2f * t) * 0.03f * melEnv;

            float noise = (Random.value * 2f - 1f) * 0.015f;

            float drone = Mathf.Sin(2f * Mathf.PI * 55f * t) * 0.04f;
            drone += Mathf.Sin(2f * Mathf.PI * 55.5f * t) * 0.03f;

            float percEnvelope = Mathf.Clamp01(1f - (i % (beatLength * 8)) / (float)(beatLength * 8) * 8f);
            float perc = (Random.value * 2f - 1f) * 0.04f * percEnvelope;

            float sample = bass + melody + noise + drone + perc;
            if (sample > 1f) sample = 1f;
            if (sample < -1f) sample = -1f;
            samples[i] = sample;
        }

        musicLoop = AudioClip.Create("ZombieMusic", totalSamples, 1, sampleRate, false);
        musicLoop.SetData(samples, 0);
        musicSource.clip = musicLoop;
        musicSource.Play();
    }

    private void PlaySound(AudioClip clip, float volume)
    {
        if (audioSource != null && clip != null) audioSource.PlayOneShot(clip, volume);
    }

    private AudioClip CreateTone(string clipName, float frequency, float duration, bool square)
    {
        const int sampleRate = 22050;
        int sampleCount = Mathf.CeilToInt(sampleRate * duration);
        var samples = new float[sampleCount];
        for (int i = 0; i < sampleCount; i++)
        {
            float t = (float)i / sampleRate;
            float wave = Mathf.Sin(2f * Mathf.PI * frequency * t);
            if (square) wave = wave >= 0f ? 0.75f : -0.75f;
            float envelope = 1f - (float)i / sampleCount;
            samples[i] = wave * envelope * 0.35f;
        }
        var clip = AudioClip.Create(clipName, sampleCount, 1, sampleRate, false);
        clip.SetData(samples, 0);
        return clip;
    }
}
