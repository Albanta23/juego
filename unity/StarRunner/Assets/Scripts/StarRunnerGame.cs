using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

public class StarRunnerGame : MonoBehaviour
{
    [Header("Tuning")]
    public float laneWidth = 2.6f;
    public float forwardSpeed = 16f;
    public float lateralSpeed = 8f;
    public float spawnDistance = 52f;

    private readonly List<Transform> hazards = new List<Transform>();
    private readonly List<Transform> pickups = new List<Transform>();
    private Transform player;
    private Text hud;
    private Camera mainCamera;
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

        mainCamera.transform.position = new Vector3(0f, 5.6f, -9f);
        mainCamera.transform.rotation = Quaternion.Euler(58f, 0f, 0f);
        mainCamera.clearFlags = CameraClearFlags.SolidColor;
        mainCamera.backgroundColor = new Color(0.02f, 0.01f, 0.08f);

        if (FindObjectOfType<Light>() == null)
        {
            var lightObject = new GameObject("Key Light");
            var light = lightObject.AddComponent<DirectionalLightFallback>();
            lightObject.transform.rotation = Quaternion.Euler(48f, -32f, 0f);
            light.Apply();
        }

        player = GameObject.CreatePrimitive(PrimitiveType.Capsule).transform;
        player.name = "Player Ship";
        player.localScale = new Vector3(0.82f, 0.42f, 1.25f);
        player.GetComponent<Renderer>().material = MakeMat(new Color(0.0f, 0.9f, 1f));

        for (int i = 0; i < 24; i++)
        {
            var star = GameObject.CreatePrimitive(PrimitiveType.Sphere).transform;
            star.name = "Parallax Star";
            star.localScale = Vector3.one * Random.Range(0.04f, 0.12f);
            star.position = new Vector3(Random.Range(-13f, 13f), Random.Range(2f, 9f), Random.Range(6f, 68f));
            star.GetComponent<Renderer>().material = MakeMat(Color.white);
        }

        var canvas = new GameObject("HUD").AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        hud = new GameObject("HUD Text").AddComponent<Text>();
        hud.transform.SetParent(canvas.transform);
        hud.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
        hud.fontSize = 22;
        hud.color = Color.cyan;
        hud.alignment = TextAnchor.UpperLeft;
        var rect = hud.GetComponent<RectTransform>();
        rect.anchorMin = new Vector2(0f, 1f);
        rect.anchorMax = new Vector2(0f, 1f);
        rect.pivot = new Vector2(0f, 1f);
        rect.anchoredPosition = new Vector2(18f, -16f);
        rect.sizeDelta = new Vector2(520f, 110f);
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
        var mat = new Material(Shader.Find("Standard"));
        mat.color = color;
        mat.EnableKeyword("_EMISSION");
        mat.SetColor("_EmissionColor", color * 0.55f);
        return mat;
    }

    private void UpdateHud()
    {
        hud.text = gameOver
            ? $"GAME OVER\nSCORE {score}\nR / ENTER PARA REINICIAR"
            : $"UNITY STAR RUNNER\nSCORE {score}  SHIELD {shield}  LVL {level}\nA/D o Flechas para cambiar de carril";
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
