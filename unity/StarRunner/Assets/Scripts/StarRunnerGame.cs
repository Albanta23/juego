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
    private Transform player;
    private Camera mainCamera;
    private string hudText;
    private float spawnTimer;
    private float distance;
    private int score;
    private int shield = 3;
    private int level = 1;
    private int targetLane;
    private bool gameOver;

    private void Start()
    {
        BuildScene();
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
        UpdateHud();
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

        mainCamera.transform.position = new Vector3(0f, 6.8f, -10.5f);
        mainCamera.transform.LookAt(new Vector3(0f, 0.35f, 14f));
        mainCamera.fieldOfView = 62f;
        mainCamera.nearClipPlane = 0.1f;
        mainCamera.clearFlags = CameraClearFlags.SolidColor;
        mainCamera.backgroundColor = new Color(0.02f, 0.01f, 0.08f);

        if (FindObjectOfType<Light>() == null)
        {
            var lightObject = new GameObject("Key Light");
            var light = lightObject.AddComponent<DirectionalLightFallback>();
            lightObject.transform.rotation = Quaternion.Euler(48f, -32f, 0f);
            light.Apply();
        }

        BuildTrack();
        BuildShip();

        for (int i = 0; i < 48; i++)
        {
            var star = GameObject.CreatePrimitive(PrimitiveType.Sphere).transform;
            star.name = "Parallax Star";
            star.localScale = Vector3.one * Random.Range(0.05f, 0.16f);
            star.position = new Vector3(Random.Range(-16f, 16f), Random.Range(1.5f, 11f), Random.Range(3f, 90f));
            star.GetComponent<Renderer>().material = MakeMat(Color.white);
            stars.Add(star);
        }
    }

    private void BuildShip()
    {
        player = new GameObject("Player Ship").transform;
        var body = CreatePart(PrimitiveType.Capsule, player, new Vector3(0f, 0.4f, 0f), new Vector3(0.72f, 0.32f, 1.2f), new Color(0f, 0.9f, 1f));
        body.localRotation = Quaternion.Euler(90f, 0f, 0f);
        CreatePart(PrimitiveType.Cube, player, new Vector3(-0.78f, 0.3f, -0.05f), new Vector3(1.25f, 0.12f, 0.65f), new Color(0.12f, 0.35f, 1f));
        CreatePart(PrimitiveType.Cube, player, new Vector3(0.78f, 0.3f, -0.05f), new Vector3(1.25f, 0.12f, 0.65f), new Color(0.12f, 0.35f, 1f));
        CreatePart(PrimitiveType.Sphere, player, new Vector3(0f, 0.58f, -0.18f), new Vector3(0.34f, 0.22f, 0.42f), new Color(1f, 0.28f, 0.8f));
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
        foreach (var h in hazards) if (h != null) Destroy(h.gameObject);
        foreach (var p in pickups) if (p != null) Destroy(p.gameObject);
        hazards.Clear();
        pickups.Clear();
        player.position = new Vector3(0f, 0.4f, 0f);
        targetLane = 0;
        score = 0;
        shield = 3;
        level = 1;
        distance = 0f;
        spawnTimer = 1.2f;
        forwardSpeed = 16f;
        gameOver = false;
    }

    private void ReadInput()
    {
        if (Input.GetKeyDown(KeyCode.LeftArrow) || Input.GetKeyDown(KeyCode.A)) targetLane = Mathf.Max(-1, targetLane - 1);
        if (Input.GetKeyDown(KeyCode.RightArrow) || Input.GetKeyDown(KeyCode.D)) targetLane = Mathf.Min(1, targetLane + 1);
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
                }
                else
                {
                    shield--;
                    if (shield <= 0) gameOver = true;
                }
                Destroy(t.gameObject);
                list.RemoveAt(i);
                continue;
            }

            if (t.position.z < -8f)
            {
                Destroy(t.gameObject);
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
        var hazard = GameObject.CreatePrimitive(Random.value > 0.6f ? PrimitiveType.Cube : PrimitiveType.Sphere).transform;
        hazard.name = "Hazard";
        hazard.position = new Vector3(Random.Range(-1, 2) * laneWidth, 0.55f, spawnDistance + Random.Range(0f, 18f));
        hazard.localScale = Vector3.one * Random.Range(0.72f, 1.22f);
        hazard.GetComponent<Renderer>().material = MakeMat(new Color(1f, 0.18f, 0.34f));
        hazards.Add(hazard);
    }

    private void SpawnPickup()
    {
        var pickup = GameObject.CreatePrimitive(PrimitiveType.Sphere).transform;
        pickup.name = "Shield Pickup";
        pickup.position = new Vector3(Random.Range(-1, 2) * laneWidth, 0.58f, spawnDistance + Random.Range(6f, 24f));
        pickup.localScale = Vector3.one * 0.55f;
        pickup.GetComponent<Renderer>().material = MakeMat(new Color(0f, 1f, 0.9f));
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

    private void UpdateHud()
    {
        hudText = gameOver
            ? $"GAME OVER\nSCORE {score}\nR / ENTER PARA REINICIAR"
            : $"UNITY STAR RUNNER\nSCORE {score}  SHIELD {shield}  LVL {level}\nA/D o Flechas para cambiar de carril";
    }

    private void OnGUI()
    {
        var style = new GUIStyle(GUI.skin.label)
        {
            fontSize = Mathf.Clamp(Screen.width / 36, 18, 28),
            normal = { textColor = new Color(0.55f, 0.95f, 1f) }
        };
        GUI.Label(new Rect(20f, 16f, Screen.width - 40f, 100f), hudText, style);
    }
}

public class DirectionalLightFallback : MonoBehaviour
{
    public void Apply()
    {
        var light = gameObject.AddComponent<Light>();
        light.type = LightType.Directional;
        light.intensity = 1.25f;
        light.color = new Color(0.75f, 0.92f, 1f);
    }
}
