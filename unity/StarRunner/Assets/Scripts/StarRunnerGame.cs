using System.Collections.Generic;
using UnityEngine;

public class StarRunnerGame : MonoBehaviour
{
    public Material baseMaterial;

    [Header("Tuning")]
    public float laneWidth = 2.6f;
    public float forwardSpeed = 16f;
    public float lateralSpeed = 8f;
    public float spawnDistance = 52f;

    private readonly List<Transform> hazards = new List<Transform>();
    private readonly List<Transform> pickups = new List<Transform>();
    private readonly List<Transform> trackSegments = new List<Transform>();
    private readonly List<Transform> stars = new List<Transform>();
    private readonly List<Transform> playerShots = new List<Transform>();
    private readonly List<Transform> enemyShots = new List<Transform>();
    private readonly Dictionary<Transform, int> enemyHealth = new Dictionary<Transform, int>();
    private Transform player;
    private Camera mainCamera;
    private Vector3 cameraBasePosition;
    private string hudText;
    private float spawnTimer;
    private float distance;
    private int score;
    private int shield = 3;
    private int level = 1;
    private int targetLane;
    private bool gameOver;
    private float screenShake;
    private float fireCooldown;
    private float enemyFireTimer;
    private AudioSource audioSource;
    private AudioClip fireSound;
    private AudioClip explosionSound;
    private AudioClip damageSound;
    private AudioClip pickupSound;

    private GUIStyle hudStyle;
    private int hudStyleFontSize = -1;

    private Material hazardMaterial;
    private Material pickupMaterial;
    private Material starMaterial;
    private Material playerShotMaterial;
    private Material enemyShotMaterial;

    private readonly Queue<GameObject> spherePool = new Queue<GameObject>();
    private readonly Queue<GameObject> cubePool = new Queue<GameObject>();

    private void Start()
    {
        BuildScene();
        BuildAudio();
        ResetGame();
    }

    private void Update()
    {
        if (gameOver)
        {
            if (Input.GetKeyDown(KeyCode.R) || Input.GetKeyDown(KeyCode.Return)) ResetGame();
            return;
        }

        ReadInput();
        MovePlayer();
        AdvanceWorld();
        SpawnObjects();
        MoveProjectiles();
        EnemyFire();
        UpdateHud();

        UpdateCameraLayout();
        if (screenShake > 0f)
        {
            screenShake -= Time.deltaTime;
            float intensity = screenShake * 0.06f;
            mainCamera.transform.position = cameraBasePosition + new Vector3(
                Random.Range(-intensity, intensity),
                Random.Range(-intensity, intensity),
                0f
            );
        }
    }

    private void BuildScene()
    {
        mainCamera = Camera.main;
        if (mainCamera == null)
        {
            var cameraObject = new GameObject("Main Camera");
            mainCamera = cameraObject.AddComponent<Camera>();
            cameraObject.tag = "MainCamera";
        }

        UpdateCameraLayout();
        mainCamera.nearClipPlane = 0.1f;
        mainCamera.clearFlags = CameraClearFlags.SolidColor;
        mainCamera.backgroundColor = new Color(0.02f, 0.01f, 0.08f);

        if (FindObjectOfType<Light>() == null)
        {
            var lightObject = new GameObject("Key Light");
            var light = lightObject.AddComponent<Light>();
            light.type = LightType.Directional;
            light.intensity = 1.25f;
            light.color = new Color(0.75f, 0.92f, 1f);
            lightObject.transform.rotation = Quaternion.Euler(48f, -32f, 0f);
        }

        hazardMaterial = MakeMat(new Color(1f, 0.18f, 0.34f));
        pickupMaterial = MakeMat(new Color(0f, 1f, 0.9f));
        starMaterial = MakeMat(Color.white);
        playerShotMaterial = MakeMat(new Color(1f, 0.9f, 0.18f));
        enemyShotMaterial = MakeMat(new Color(1f, 0.12f, 0.65f));

        BuildTrack();
        BuildShip();

        for (int i = 0; i < 48; i++)
        {
            var star = GameObject.CreatePrimitive(PrimitiveType.Sphere).transform;
            star.name = "Parallax Star";
            star.localScale = Vector3.one * Random.Range(0.05f, 0.16f);
            star.position = new Vector3(Random.Range(-16f, 16f), Random.Range(1.5f, 11f), Random.Range(3f, 90f));
            star.GetComponent<Renderer>().material = starMaterial;
            stars.Add(star);
        }

        for (int i = 0; i < 8; i++)
        {
            var cube = GameObject.CreatePrimitive(PrimitiveType.Cube);
            cube.SetActive(false);
            cubePool.Enqueue(cube);
        }
        for (int i = 0; i < 6; i++)
        {
            var sphere = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            sphere.SetActive(false);
            spherePool.Enqueue(sphere);
        }
    }

    private Transform GetFromPool(Queue<GameObject> pool, PrimitiveType type, string name, Material mat, Vector3 position, Vector3 scale)
    {
        GameObject obj = null;
        while (pool.Count > 0 && obj == null)
        {
            obj = pool.Dequeue();
            if (obj == null) obj = null;
        }
        if (obj == null) obj = GameObject.CreatePrimitive(type);
        else obj.transform.rotation = Quaternion.identity;
        obj.name = name;
        obj.transform.position = position;
        obj.transform.localScale = scale;
        obj.GetComponent<Renderer>().material = mat;
        obj.SetActive(true);
        return obj.transform;
    }

    private void ReturnToPool(Queue<GameObject> pool, GameObject obj)
    {
        obj.SetActive(false);
        pool.Enqueue(obj);
    }

    private void BuildShip()
    {
        player = new GameObject("Player Ship").transform;
        var body = CreatePart(PrimitiveType.Capsule, player, new Vector3(0f, 0.4f, 0f), new Vector3(0.72f, 0.32f, 1.2f), new Color(0f, 0.9f, 1f));
        body.localRotation = Quaternion.Euler(90f, 0f, 0f);
        CreatePart(PrimitiveType.Cube, player, new Vector3(-0.78f, 0.3f, -0.05f), new Vector3(1.25f, 0.12f, 0.65f), new Color(0.12f, 0.35f, 1f));
        CreatePart(PrimitiveType.Cube, player, new Vector3(0.78f, 0.3f, -0.05f), new Vector3(1.25f, 0.12f, 0.65f), new Color(0.12f, 0.35f, 1f));
        CreatePart(PrimitiveType.Sphere, player, new Vector3(0f, 0.58f, -0.18f), new Vector3(0.34f, 0.22f, 0.42f), new Color(1f, 0.28f, 0.8f));

        var collider = player.gameObject.AddComponent<SphereCollider>();
        collider.isTrigger = true;
        collider.radius = 1.2f;
    }

    private Transform CreatePart(PrimitiveType type, Transform parent, Vector3 position, Vector3 scale, Color color)
    {
        var part = GameObject.CreatePrimitive(type).transform;
        part.SetParent(parent, false);
        part.localPosition = position;
        part.localScale = scale;
        part.GetComponent<Renderer>().material = MakeMat(color);
        return part;
    }

    private void BuildTrack()
    {
        for (int i = 0; i < 14; i++)
        {
            var segment = new GameObject("Track Segment").transform;
            segment.position = new Vector3(0f, 0f, i * 8f - 4f);
            CreatePart(PrimitiveType.Cube, segment, new Vector3(0f, -0.18f, 0f), new Vector3(8.8f, 0.25f, 7.8f), new Color(0.025f, 0.04f, 0.12f));
            for (int lane = -1; lane <= 1; lane += 2)
                CreatePart(PrimitiveType.Cube, segment, new Vector3(lane * laneWidth * 0.5f, 0.01f, 0f), new Vector3(0.08f, 0.035f, 3.4f), new Color(0f, 0.85f, 1f));
            CreatePart(PrimitiveType.Cube, segment, new Vector3(-5.1f, 0.55f, 0f), new Vector3(0.18f, 1.1f, 0.18f), new Color(1f, 0.18f, 0.62f));
            CreatePart(PrimitiveType.Cube, segment, new Vector3(5.1f, 0.55f, 0f), new Vector3(0.18f, 1.1f, 0.18f), new Color(1f, 0.18f, 0.62f));
            trackSegments.Add(segment);
        }
    }

    private void ResetGame()
    {
        foreach (var h in hazards) if (h != null) ReturnToPool(GetPoolForObject(h.gameObject), h.gameObject);
        foreach (var p in pickups) if (p != null) ReturnToPool(spherePool, p.gameObject);
        hazards.Clear();
        pickups.Clear();
        foreach (var shot in playerShots) if (shot != null) Destroy(shot.gameObject);
        foreach (var shot in enemyShots) if (shot != null) Destroy(shot.gameObject);
        playerShots.Clear();
        enemyShots.Clear();
        enemyHealth.Clear();
        player.position = new Vector3(0f, 0.4f, 0f);
        targetLane = 0;
        score = 0;
        shield = 3;
        level = 1;
        distance = 0f;
        spawnTimer = 1.2f;
        forwardSpeed = 16f;
        gameOver = false;
        screenShake = 0f;
        fireCooldown = 0f;
        enemyFireTimer = 2.4f;
    }

    private Queue<GameObject> GetPoolForObject(GameObject obj)
    {
        var filter = obj.GetComponent<MeshFilter>();
        if (filter != null && filter.sharedMesh != null)
        {
            if (filter.sharedMesh.vertexCount == 24) return cubePool;
        }
        return spherePool;
    }

    private void ReadInput()
    {
        if (Input.GetKeyDown(KeyCode.LeftArrow) || Input.GetKeyDown(KeyCode.A)) targetLane = Mathf.Max(-1, targetLane - 1);
        if (Input.GetKeyDown(KeyCode.RightArrow) || Input.GetKeyDown(KeyCode.D)) targetLane = Mathf.Min(1, targetLane + 1);
        if (Input.GetKey(KeyCode.Space) || Input.GetKey(KeyCode.X) || Input.GetKey(KeyCode.UpArrow)) Fire();
    }

    private void MovePlayer()
    {
        var targetX = targetLane * laneWidth;
        var pos = player.position;
        pos.x = Mathf.MoveTowards(pos.x, targetX, lateralSpeed * Time.deltaTime);
        player.position = pos;
        player.rotation = Quaternion.Euler(0f, 0f, (targetX - pos.x) * -10f);
    }

    private void AdvanceWorld()
    {
        fireCooldown = Mathf.Max(0f, fireCooldown - Time.deltaTime);
        distance += forwardSpeed * Time.deltaTime;
        level = 1 + Mathf.FloorToInt(distance / 220f);
        forwardSpeed = Mathf.Min(30f, 16f + level * 1.2f);
        score = Mathf.Max(score, Mathf.FloorToInt(distance * 2f));

        MoveList(hazards, false);
        MoveList(pickups, true);
        MoveEnvironment();
    }

    private void MoveEnvironment()
    {
        float delta = forwardSpeed * Time.deltaTime;
        float furthest = -100f;
        foreach (Transform segment in trackSegments) furthest = Mathf.Max(furthest, segment.position.z);
        foreach (Transform segment in trackSegments)
        {
            segment.position += Vector3.back * delta;
            if (segment.position.z < -10f) segment.position = new Vector3(0f, 0f, furthest + 8f);
        }
        foreach (Transform star in stars)
        {
            star.position += Vector3.back * delta * 0.18f;
            if (star.position.z < -8f) star.position = new Vector3(Random.Range(-16f, 16f), Random.Range(1.5f, 11f), 90f);
        }
    }

    private void MoveList(List<Transform> list, bool isPickup)
    {
        for (int i = list.Count - 1; i >= 0; i--)
        {
            var t = list[i];
            if (t == null)
            {
                list.RemoveAt(i);
                continue;
            }

            t.position += Vector3.back * forwardSpeed * Time.deltaTime;
            t.Rotate(Vector3.up, 95f * Time.deltaTime);

            if (Vector3.Distance(t.position, player.position) < (isPickup ? 1.05f : 1.25f))
            {
                if (isPickup)
                {
                    shield = Mathf.Min(5, shield + 1);
                    score += 250;
                    PlaySound(pickupSound, 0.8f);
                }
                else
                {
                    shield--;
                    screenShake = 0.3f;
                    PlaySound(damageSound, 0.9f);
                    if (shield <= 0) gameOver = true;
                }
                enemyHealth.Remove(t);
                ReturnToPool(isPickup ? spherePool : GetPoolForObject(t.gameObject), t.gameObject);
                list.RemoveAt(i);
                continue;
            }

            if (t.position.z < -8f)
            {
                ReturnToPool(isPickup ? spherePool : GetPoolForObject(t.gameObject), t.gameObject);
                list.RemoveAt(i);
            }
        }
    }

    private void SpawnObjects()
    {
        spawnTimer -= Time.deltaTime;
        if (spawnTimer > 0f) return;

        var maxThreats = Mathf.Min(9, 2 + level);
        if (hazards.Count < maxThreats)
        {
            SpawnHazard();
            if (level > 3 && Random.value > 0.62f) SpawnHazard();
        }

        if (pickups.Count < 2 && Random.value > 0.74f) SpawnPickup();
        spawnTimer = Mathf.Max(0.42f, 1.45f - level * 0.08f);
    }

    private void SpawnHazard()
    {
        bool isCube = Random.value > 0.6f;
        float scale = Random.Range(0.72f, 1.22f);
        var hazard = GetFromPool(
            isCube ? cubePool : spherePool,
            isCube ? PrimitiveType.Cube : PrimitiveType.Sphere,
            "Hazard",
            hazardMaterial,
            new Vector3(Random.Range(-1, 2) * laneWidth, 0.55f, spawnDistance + Random.Range(0f, 18f)),
            Vector3.one * scale
        );
        hazards.Add(hazard);
        enemyHealth[hazard] = 1 + Mathf.FloorToInt(level / 3f);
    }

    private void SpawnPickup()
    {
        var pickup = GetFromPool(
            spherePool,
            PrimitiveType.Sphere,
            "Shield Pickup",
            pickupMaterial,
            new Vector3(Random.Range(-1, 2) * laneWidth, 0.58f, spawnDistance + Random.Range(6f, 24f)),
            Vector3.one * 0.55f
        );
        pickups.Add(pickup);
    }

    private Material MakeMat(Color color)
    {
        var mat = baseMaterial != null
            ? new Material(baseMaterial)
            : new Material(Shader.Find("Sprites/Default"));
        mat.color = color;
        mat.EnableKeyword("_EMISSION");
        mat.SetColor("_EmissionColor", color * 0.55f);
        return mat;
    }

    private void Fire()
    {
        if (fireCooldown > 0f || gameOver) return;
        fireCooldown = Mathf.Max(0.12f, 0.3f - level * 0.012f);
        var shot = GameObject.CreatePrimitive(PrimitiveType.Sphere).transform;
        shot.name = "Player Plasma";
        shot.position = player.position + new Vector3(0f, 0.55f, 1.4f);
        shot.localScale = new Vector3(0.2f, 0.2f, 0.7f);
        shot.GetComponent<Renderer>().material = playerShotMaterial;
        playerShots.Add(shot);
        PlaySound(fireSound, 0.42f);
    }

    private void MoveProjectiles()
    {
        for (int i = playerShots.Count - 1; i >= 0; i--)
        {
            Transform shot = playerShots[i];
            if (shot == null) { playerShots.RemoveAt(i); continue; }
            shot.position += Vector3.forward * 38f * Time.deltaTime;
            bool consumed = false;
            for (int h = hazards.Count - 1; h >= 0; h--)
            {
                Transform enemy = hazards[h];
                if (enemy == null || Vector3.Distance(shot.position, enemy.position) > 1.25f) continue;
                int health = enemyHealth.TryGetValue(enemy, out int current) ? current - 1 : 0;
                if (health <= 0)
                {
                    score += 180 + level * 20;
                    SpawnBurst(enemy.position, hazardMaterial);
                    PlaySound(explosionSound, 0.75f);
                    enemyHealth.Remove(enemy);
                    ReturnToPool(GetPoolForObject(enemy.gameObject), enemy.gameObject);
                    hazards.RemoveAt(h);
                }
                else enemyHealth[enemy] = health;
                Destroy(shot.gameObject);
                playerShots.RemoveAt(i);
                consumed = true;
                break;
            }
            if (!consumed && shot.position.z > 82f)
            {
                Destroy(shot.gameObject);
                playerShots.RemoveAt(i);
            }
        }

        for (int i = enemyShots.Count - 1; i >= 0; i--)
        {
            Transform shot = enemyShots[i];
            if (shot == null) { enemyShots.RemoveAt(i); continue; }
            shot.position += Vector3.back * (18f + level) * Time.deltaTime;
            if (Vector3.Distance(shot.position, player.position) < 1f)
            {
                shield--;
                screenShake = 0.35f;
                PlaySound(damageSound, 0.9f);
                Destroy(shot.gameObject);
                enemyShots.RemoveAt(i);
                if (shield <= 0) gameOver = true;
            }
            else if (shot.position.z < -8f)
            {
                Destroy(shot.gameObject);
                enemyShots.RemoveAt(i);
            }
        }
    }

    private void EnemyFire()
    {
        enemyFireTimer -= Time.deltaTime;
        if (enemyFireTimer > 0f || hazards.Count == 0) return;
        Transform enemy = hazards[Random.Range(0, hazards.Count)];
        if (enemy != null && enemy.position.z > 8f && enemy.position.z < 48f)
        {
            var shot = GameObject.CreatePrimitive(PrimitiveType.Sphere).transform;
            shot.name = "Enemy Plasma";
            shot.position = enemy.position + Vector3.back;
            shot.localScale = new Vector3(0.24f, 0.24f, 0.6f);
            shot.GetComponent<Renderer>().material = enemyShotMaterial;
            enemyShots.Add(shot);
        }
        enemyFireTimer = Mathf.Max(0.85f, 2.8f - level * 0.14f);
    }

    private void SpawnBurst(Vector3 position, Material material)
    {
        for (int i = 0; i < 7; i++)
        {
            var particle = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            particle.name = "Explosion Particle";
            particle.transform.position = position;
            particle.transform.localScale = Vector3.one * Random.Range(0.12f, 0.3f);
            particle.GetComponent<Renderer>().material = material;
            var burst = particle.AddComponent<StarRunnerBurst>();
            burst.velocity = Random.onUnitSphere * Random.Range(2.5f, 6f);
        }
    }

    private void BuildAudio()
    {
        audioSource = gameObject.AddComponent<AudioSource>();
        audioSource.playOnAwake = false;
        fireSound = CreateTone("Laser", 860f, 0.07f, false);
        explosionSound = CreateTone("Explosion", 90f, 0.32f, true);
        damageSound = CreateTone("Damage", 130f, 0.25f, true);
        pickupSound = CreateTone("Pickup", 620f, 0.18f, false);
    }

    private AudioClip CreateTone(string clipName, float frequency, float duration, bool square)
    {
        const int sampleRate = 22050;
        int count = Mathf.CeilToInt(sampleRate * duration);
        var samples = new float[count];
        for (int i = 0; i < count; i++)
        {
            float wave = Mathf.Sin(2f * Mathf.PI * frequency * i / sampleRate);
            if (square) wave = wave >= 0f ? 0.7f : -0.7f;
            samples[i] = wave * (1f - (float)i / count) * 0.32f;
        }
        var clip = AudioClip.Create(clipName, count, 1, sampleRate, false);
        clip.SetData(samples, 0);
        return clip;
    }

    private void PlaySound(AudioClip clip, float volume)
    {
        if (audioSource != null && clip != null) audioSource.PlayOneShot(clip, volume);
    }

    private void UpdateCameraLayout()
    {
        float aspect = Screen.height > 0 ? (float)Screen.width / Screen.height : 1.6f;
        cameraBasePosition = aspect < 0.85f ? new Vector3(0f, 8.8f, -12.8f) : new Vector3(0f, 6.8f, -10.5f);
        mainCamera.fieldOfView = aspect < 0.85f ? 72f : 62f;
        if (screenShake <= 0f) mainCamera.transform.position = cameraBasePosition;
        mainCamera.transform.LookAt(new Vector3(0f, 0.35f, 14f));
    }

    private void UpdateHud()
    {
        hudText = gameOver
            ? $"GAME OVER\nSCORE {score}\nR / ENTER PARA REINICIAR"
            : $"UNITY STAR RUNNER\nSCORE {score}  SHIELD {shield}  LVL {level}\nMOVER A/D · DISPARAR ESPACIO/X";
    }

    private void OnGUI()
    {
        int targetSize = Mathf.Clamp(Screen.width / 36, 18, 28);
        if (hudStyle == null || hudStyleFontSize != targetSize)
        {
            hudStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = targetSize,
                normal = { textColor = new Color(0.55f, 0.95f, 1f) }
            };
            hudStyleFontSize = targetSize;
        }
        GUI.Label(new Rect(20f, 16f, Screen.width - 40f, 100f), hudText, hudStyle);

        if (Input.touchSupported || Application.isMobilePlatform || Screen.width < 900)
        {
            float size = Mathf.Clamp(Mathf.Min(Screen.width, Screen.height) * 0.16f, 64f, 112f);
            float y = Screen.height - size - 18f;
            if (GUI.Button(new Rect(18f, y, size, size), "LEFT")) targetLane = Mathf.Max(-1, targetLane - 1);
            if (GUI.Button(new Rect(30f + size, y, size, size), "RIGHT")) targetLane = Mathf.Min(1, targetLane + 1);
            if (GUI.Button(new Rect(Screen.width - size - 22f, y - size * 0.15f, size, size), "FIRE")) Fire();
        }
    }
}

public class StarRunnerBurst : MonoBehaviour
{
    public Vector3 velocity;
    private float life = 0.55f;

    private void Update()
    {
        transform.position += velocity * Time.deltaTime;
        velocity *= 0.92f;
        life -= Time.deltaTime;
        transform.localScale *= 0.93f;
        if (life <= 0f) Destroy(gameObject);
    }
}
