using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;

public class NeonMazeGame : MonoBehaviour
{
    private const int Columns = 19;
    private const int Rows = 15;
    private const float Tile = 1.1f;
    private readonly string[] maze =
    {
        "###################",
        "#o........#......o#",
        "#.###.###.#.###.###",
        "#.....#.......#...#",
        "#.###.#.#####.#.#.#",
        "#.#...#...#...#.#.#",
        "#.#.#####.#.#####.#",
        "....#....   ....#..",
        "#.#####.###.#####.#",
        "#.....#.....#.....#",
        "###.#.#.###.#.#.###",
        "#...#...#.#...#...#",
        "#.#####.#.#####.#.#",
        "#o...............o#",
        "###################"
    };

    private readonly Vector2Int[] directions =
    {
        Vector2Int.up, Vector2Int.left, Vector2Int.down, Vector2Int.right
    };

    private Transform player;
    private readonly List<Ghost> ghosts = new List<Ghost>();
    private readonly Dictionary<Vector2Int, GameObject> dots = new Dictionary<Vector2Int, GameObject>();
    private Text hud;
    private Text message;
    private Vector2Int playerCell;
    private Vector2Int desiredDirection = Vector2Int.left;
    private Vector2Int moveDirection = Vector2Int.left;
    private float moveProgress;
    private int score;
    private int lives = 3;
    private int level = 1;
    private int dotsLeft;
    private float frightenedTimer;
    private float startTimer;
    private bool gameOver;

    private class Ghost
    {
        public Transform body;
        public Vector2Int cell;
        public Vector2Int direction;
        public Vector2Int spawn;
        public Color color;
        public float progress;
        public float respawnTimer;
    }

    private void Start()
    {
        BuildScene();
        StartLevel(true);
    }

    private void Update()
    {
        ReadInput();
        if (gameOver)
        {
            if (Input.GetKeyDown(KeyCode.Return) || Input.GetKeyDown(KeyCode.R)) RestartGame();
            return;
        }

        if (startTimer > 0f)
        {
            startTimer -= Time.deltaTime;
            UpdateHud();
            return;
        }

        frightenedTimer = Mathf.Max(0f, frightenedTimer - Time.deltaTime);
        MovePlayer();
        MoveGhosts();
        UpdateHud();
    }

    private void BuildScene()
    {
        var camera = Camera.main;
        if (camera == null)
        {
            camera = new GameObject("Main Camera").AddComponent<Camera>();
            camera.tag = "MainCamera";
        }
        camera.transform.position = new Vector3(0f, 17.5f, -13.5f);
        camera.transform.rotation = Quaternion.Euler(52f, 0f, 0f);
        camera.orthographic = true;
        camera.orthographicSize = 11.7f;
        camera.backgroundColor = new Color(0.012f, 0.018f, 0.055f);

        var lightObject = new GameObject("Neon Key Light");
        var light = lightObject.AddComponent<Light>();
        light.type = LightType.Directional;
        light.color = new Color(0.44f, 0.77f, 1f);
        light.intensity = 1.15f;
        lightObject.transform.rotation = Quaternion.Euler(55f, -25f, 0f);

        var floor = GameObject.CreatePrimitive(PrimitiveType.Cube);
        floor.name = "Reflective Floor";
        floor.transform.position = new Vector3(0f, -0.22f, 0f);
        floor.transform.localScale = new Vector3(Columns * Tile + 2f, 0.25f, Rows * Tile + 2f);
        floor.GetComponent<Renderer>().material = MaterialFor(new Color(0.015f, 0.025f, 0.09f), 0.06f);

        for (int row = 0; row < Rows; row++)
        for (int col = 0; col < Columns; col++)
        {
            var cell = new Vector2Int(col, row);
            if (maze[row][col] == '#') CreateWall(cell);
        }

        player = GameObject.CreatePrimitive(PrimitiveType.Sphere).transform;
        player.name = "Neon Pac";
        player.localScale = Vector3.one * 0.82f;
        player.GetComponent<Renderer>().material = MaterialFor(new Color(1f, 0.76f, 0.04f), 1.1f);
        CreateHud();
    }

    private void StartLevel(bool resetScore)
    {
        ClearDots();
        if (resetScore) { score = 0; lives = 3; level = 1; }
        playerCell = new Vector2Int(9, 11);
        desiredDirection = Vector2Int.left;
        moveDirection = Vector2Int.left;
        moveProgress = 0f;
        player.position = World(playerCell) + Vector3.up * 0.48f;
        frightenedTimer = 0f;
        gameOver = false;
        BuildDots();
        SpawnGhosts();
        startTimer = 1.5f;
        message.text = "READY!";
        message.gameObject.SetActive(true);
    }

    private void RestartGame() => StartLevel(true);

    private void BuildDots()
    {
        dotsLeft = 0;
        for (int row = 0; row < Rows; row++)
        for (int col = 0; col < Columns; col++)
        {
            char type = maze[row][col];
            if (type != '.' && type != 'o') continue;
            var dot = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            dot.name = type == 'o' ? "Power Orb" : "Energy Dot";
            dot.transform.position = World(new Vector2Int(col, row)) + Vector3.up * 0.32f;
            dot.transform.localScale = Vector3.one * (type == 'o' ? 0.3f : 0.13f);
            dot.GetComponent<Renderer>().material = MaterialFor(type == 'o' ? new Color(1f, 0.3f, 0.83f) : new Color(0.75f, 0.96f, 1f), type == 'o' ? 1.3f : 0.4f);
            dots[new Vector2Int(col, row)] = dot;
            dotsLeft++;
        }
    }

    private void SpawnGhosts()
    {
        foreach (Ghost ghost in ghosts) if (ghost.body != null) Destroy(ghost.body.gameObject);
        ghosts.Clear();
        Vector2Int[] spawns = { new Vector2Int(8, 7), new Vector2Int(9, 7), new Vector2Int(10, 7), new Vector2Int(9, 9) };
        Color[] colors = { new Color(1f, 0.18f, 0.36f), new Color(0.05f, 0.9f, 1f), new Color(1f, 0.34f, 0.78f), new Color(1f, 0.58f, 0.12f) };
        for (int i = 0; i < spawns.Length; i++)
        {
            var body = GameObject.CreatePrimitive(PrimitiveType.Capsule).transform;
            body.name = "Neon Ghost";
            body.localScale = new Vector3(0.66f, 0.72f, 0.66f);
            body.position = World(spawns[i]) + Vector3.up * 0.48f;
            body.GetComponent<Renderer>().material = MaterialFor(colors[i], 0.9f);
            ghosts.Add(new Ghost { body = body, cell = spawns[i], spawn = spawns[i], direction = directions[i], color = colors[i] });
        }
    }

    private void MovePlayer()
    {
        if (CanMove(playerCell, desiredDirection)) moveDirection = desiredDirection;
        if (!CanMove(playerCell, moveDirection)) return;
        moveProgress += Time.deltaTime * (5.7f + level * 0.18f);
        player.position = Vector3.Lerp(World(playerCell), World(playerCell + moveDirection), moveProgress) + Vector3.up * 0.48f;
        player.rotation = Quaternion.LookRotation(new Vector3(moveDirection.x, 0f, moveDirection.y));
        if (moveProgress < 1f) return;
        playerCell = Wrap(playerCell + moveDirection);
        moveProgress = 0f;
        CollectDot();
    }

    private void MoveGhosts()
    {
        float speed = 3.0f + level * 0.22f + (frightenedTimer > 0f ? -0.65f : 0f);
        foreach (Ghost ghost in ghosts)
        {
            if (ghost.respawnTimer > 0f) { ghost.respawnTimer -= Time.deltaTime; continue; }
            if (ghost.progress <= 0.01f) ChooseGhostDirection(ghost);
            ghost.progress += Time.deltaTime * speed;
            ghost.body.position = Vector3.Lerp(World(ghost.cell), World(ghost.cell + ghost.direction), ghost.progress) + Vector3.up * 0.48f;
            ghost.body.GetComponent<Renderer>().material.color = frightenedTimer > 0f ? new Color(0.18f, 0.35f, 1f) : ghost.color;
            if (ghost.progress >= 1f) { ghost.cell = Wrap(ghost.cell + ghost.direction); ghost.progress = 0f; }
            if (Vector3.Distance(ghost.body.position, player.position) < 0.7f) ResolveGhostHit(ghost);
        }
    }

    private void ChooseGhostDirection(Ghost ghost)
    {
        var choices = new List<Vector2Int>();
        foreach (Vector2Int direction in directions)
        {
            if (direction == -ghost.direction && choices.Count > 0) continue;
            if (CanMove(ghost.cell, direction)) choices.Add(direction);
        }
        if (choices.Count == 0) { ghost.direction = -ghost.direction; return; }
        Vector2Int best = choices[Random.Range(0, choices.Count)];
        float bestDistance = frightenedTimer > 0f ? -1f : float.MaxValue;
        foreach (Vector2Int choice in choices)
        {
            float distance = (Wrap(ghost.cell + choice) - playerCell).sqrMagnitude;
            bool better = frightenedTimer > 0f ? distance > bestDistance : distance < bestDistance;
            if (better && (Random.value > 0.22f || level > 2)) { best = choice; bestDistance = distance; }
        }
        ghost.direction = best;
    }

    private void CollectDot()
    {
        if (!dots.TryGetValue(playerCell, out GameObject dot)) return;
        bool power = dot.name == "Power Orb";
        Destroy(dot);
        dots.Remove(playerCell);
        dotsLeft--;
        score += power ? 50 : 10;
        if (power) frightenedTimer = 7f;
        if (dotsLeft > 0) return;
        level++;
        StartLevel(false);
    }

    private void ResolveGhostHit(Ghost ghost)
    {
        if (frightenedTimer > 0f)
        {
            score += 200;
            ghost.cell = ghost.spawn;
            ghost.progress = 0f;
            ghost.respawnTimer = 2f;
            ghost.body.position = World(ghost.spawn) + Vector3.up * 0.48f;
            return;
        }
        lives--;
        if (lives <= 0) { gameOver = true; message.text = "GAME OVER\nPULSA R O ENTER"; message.gameObject.SetActive(true); return; }
        playerCell = new Vector2Int(9, 11);
        player.position = World(playerCell) + Vector3.up * 0.48f;
        moveProgress = 0f;
        startTimer = 1.2f;
        message.text = "PREPARATE";
        message.gameObject.SetActive(true);
    }

    private void ReadInput()
    {
        if (Input.GetKeyDown(KeyCode.W) || Input.GetKeyDown(KeyCode.UpArrow)) desiredDirection = Vector2Int.up;
        if (Input.GetKeyDown(KeyCode.S) || Input.GetKeyDown(KeyCode.DownArrow)) desiredDirection = Vector2Int.down;
        if (Input.GetKeyDown(KeyCode.A) || Input.GetKeyDown(KeyCode.LeftArrow)) desiredDirection = Vector2Int.left;
        if (Input.GetKeyDown(KeyCode.D) || Input.GetKeyDown(KeyCode.RightArrow)) desiredDirection = Vector2Int.right;
        if (Input.touchCount == 0 || EventSystem.current != null && EventSystem.current.IsPointerOverGameObject(Input.GetTouch(0).fingerId)) return;
        Touch touch = Input.GetTouch(0);
        if (touch.phase != TouchPhase.Ended) return;
        Vector2 delta = touch.position - touch.rawPosition + touch.deltaPosition;
        if (Mathf.Abs(delta.x) > Mathf.Abs(delta.y)) desiredDirection = delta.x > 0f ? Vector2Int.right : Vector2Int.left;
        else desiredDirection = delta.y > 0f ? Vector2Int.up : Vector2Int.down;
    }

    public void SetDirection(string direction)
    {
        if (direction == "up") desiredDirection = Vector2Int.up;
        if (direction == "down") desiredDirection = Vector2Int.down;
        if (direction == "left") desiredDirection = Vector2Int.left;
        if (direction == "right") desiredDirection = Vector2Int.right;
    }

    private bool CanMove(Vector2Int cell, Vector2Int direction)
    {
        Vector2Int next = Wrap(cell + direction);
        return maze[next.y][next.x] != '#';
    }

    private Vector2Int Wrap(Vector2Int cell)
    {
        if (cell.x < 0) cell.x = Columns - 1;
        if (cell.x >= Columns) cell.x = 0;
        return cell;
    }

    private Vector3 World(Vector2Int cell) => new Vector3((cell.x - (Columns - 1) * 0.5f) * Tile, 0f, (cell.y - (Rows - 1) * 0.5f) * Tile);

    private void CreateWall(Vector2Int cell)
    {
        var wall = GameObject.CreatePrimitive(PrimitiveType.Cube);
        wall.name = "Neon Maze Wall";
        wall.transform.position = World(cell) + Vector3.up * 0.45f;
        wall.transform.localScale = new Vector3(Tile, 0.9f, Tile);
        wall.GetComponent<Renderer>().material = MaterialFor(new Color(0.07f, 0.18f, 0.54f), 0.5f);
    }

    private Material MaterialFor(Color color, float emission)
    {
        var material = new Material(Shader.Find("Standard"));
        material.color = color;
        material.EnableKeyword("_EMISSION");
        material.SetColor("_EmissionColor", color * emission);
        return material;
    }

    private void CreateHud()
    {
        var canvas = new GameObject("HUD").AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.gameObject.AddComponent<CanvasScaler>().uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        canvas.GetComponent<CanvasScaler>().referenceResolution = new Vector2(1080, 720);
        var eventSystem = new GameObject("EventSystem");
        eventSystem.AddComponent<EventSystem>();
        eventSystem.AddComponent<StandaloneInputModule>();
        hud = CreateText(canvas.transform, "HUD", TextAnchor.UpperLeft, new Vector2(26, -22), new Vector2(680, 100), 26, new Color(0.8f, 0.95f, 1f));
        message = CreateText(canvas.transform, "Message", TextAnchor.MiddleCenter, Vector2.zero, new Vector2(700, 210), 48, new Color(1f, 0.82f, 0.16f));
        message.GetComponent<RectTransform>().anchorMin = message.GetComponent<RectTransform>().anchorMax = new Vector2(0.5f, 0.5f);
        CreateButton(canvas.transform, "LEFT", new Vector2(80, 75), new Vector2(125, 90), "left");
        CreateButton(canvas.transform, "RIGHT", new Vector2(230, 75), new Vector2(125, 90), "right");
        CreateButton(canvas.transform, "UP", new Vector2(-155, 75), new Vector2(125, 90), "up");
        CreateButton(canvas.transform, "DOWN", new Vector2(-5, 75), new Vector2(125, 90), "down");
    }

    private Text CreateText(Transform parent, string name, TextAnchor anchor, Vector2 position, Vector2 size, int fontSize, Color color)
    {
        var text = new GameObject(name).AddComponent<Text>();
        text.transform.SetParent(parent);
        text.font = Resources.GetBuiltinResource<Font>("Arial.ttf");
        text.fontSize = fontSize;
        text.color = color;
        text.alignment = anchor;
        var rect = text.rectTransform;
        rect.anchorMin = new Vector2(0f, 1f); rect.anchorMax = new Vector2(0f, 1f); rect.pivot = new Vector2(0f, 1f);
        rect.anchoredPosition = position; rect.sizeDelta = size;
        return text;
    }

    private void CreateButton(Transform parent, string label, Vector2 position, Vector2 size, string direction)
    {
        var button = new GameObject(label).AddComponent<Button>();
        button.transform.SetParent(parent);
        var image = button.gameObject.AddComponent<Image>();
        image.color = new Color(0.05f, 0.22f, 0.55f, 0.86f);
        var rect = button.GetComponent<RectTransform>();
        rect.anchorMin = rect.anchorMax = new Vector2(1f, 0f); rect.pivot = new Vector2(1f, 0f);
        rect.anchoredPosition = position; rect.sizeDelta = size;
        var text = CreateText(button.transform, "Label", TextAnchor.MiddleCenter, Vector2.zero, size, 25, Color.white);
        text.rectTransform.anchorMin = Vector2.zero; text.rectTransform.anchorMax = Vector2.one; text.rectTransform.pivot = new Vector2(0.5f, 0.5f); text.rectTransform.anchoredPosition = Vector2.zero;
        text.text = label;
        button.onClick.AddListener(() => SetDirection(direction));
    }

    private void ClearDots()
    {
        foreach (GameObject dot in dots.Values) if (dot != null) Destroy(dot);
        dots.Clear();
    }

    private void UpdateHud()
    {
        message.gameObject.SetActive(startTimer > 0f || gameOver);
        hud.text = "UNITY NEON MAZE\nSCORE " + score + "    LIVES " + lives + "    LEVEL " + level + (frightenedTimer > 0f ? "    POWER " + Mathf.CeilToInt(frightenedTimer) : "");
    }
}
