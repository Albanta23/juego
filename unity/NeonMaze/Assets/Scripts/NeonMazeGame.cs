using System.Collections.Generic;
using UnityEngine;

public class NeonMazeGame : MonoBehaviour
{
    public Material baseMaterial;

    private const int Columns = 19;
    private const int Rows = 15;
    private const float Tile = 1.1f;
    private static readonly Vector2Int PlayerSpawn = new Vector2Int(9, 13);
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
    private string hudText;
    private string messageText;
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
    private AudioSource audioSource;
    private AudioClip dotSound;
    private AudioClip powerSound;
    private AudioClip hitSound;
    private AudioClip levelSound;

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
        BuildAudio();
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
        playerCell = PlayerSpawn;
        desiredDirection = Vector2Int.left;
        moveDirection = Vector2Int.left;
        moveProgress = 0f;
        player.position = World(playerCell) + Vector3.up * 0.48f;
        frightenedTimer = 0f;
        gameOver = false;
        BuildDots();
        SpawnGhosts();
        startTimer = 1.5f;
        messageText = "READY!";
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
        if (power)
        {
            frightenedTimer = 7f;
            PlaySound(powerSound, 0.75f);
        }
        else PlaySound(dotSound, 0.28f);
        if (dotsLeft > 0) return;
        level++;
        PlaySound(levelSound, 0.8f);
        StartLevel(false);
    }

    private void ResolveGhostHit(Ghost ghost)
    {
        if (frightenedTimer > 0f)
        {
            score += 200;
            PlaySound(powerSound, 0.65f);
            ghost.cell = ghost.spawn;
            ghost.progress = 0f;
            ghost.respawnTimer = 2f;
            ghost.body.position = World(ghost.spawn) + Vector3.up * 0.48f;
            return;
        }
        lives--;
        PlaySound(hitSound, 0.85f);
        if (lives <= 0) { gameOver = true; messageText = "GAME OVER\nPULSA R O ENTER"; return; }
        playerCell = PlayerSpawn;
        player.position = World(playerCell) + Vector3.up * 0.48f;
        moveProgress = 0f;
        startTimer = 1.2f;
        messageText = "PREPARATE";
    }

    private void ReadInput()
    {
        if (Input.GetKey(KeyCode.W) || Input.GetKey(KeyCode.UpArrow)) desiredDirection = Vector2Int.up;
        if (Input.GetKey(KeyCode.S) || Input.GetKey(KeyCode.DownArrow)) desiredDirection = Vector2Int.down;
        if (Input.GetKey(KeyCode.A) || Input.GetKey(KeyCode.LeftArrow)) desiredDirection = Vector2Int.left;
        if (Input.GetKey(KeyCode.D) || Input.GetKey(KeyCode.RightArrow)) desiredDirection = Vector2Int.right;
        if (Input.touchCount == 0) return;
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
        var material = baseMaterial != null
            ? new Material(baseMaterial)
            : new Material(Shader.Find("Sprites/Default"));
        material.color = color;
        material.EnableKeyword("_EMISSION");
        material.SetColor("_EmissionColor", color * emission);
        return material;
    }

    private void CreateHud()
    {
        hudText = "UNITY NEON MAZE";
    }

    private void BuildAudio()
    {
        audioSource = gameObject.AddComponent<AudioSource>();
        audioSource.playOnAwake = false;
        dotSound = CreateTone("Dot", 540f, 0.055f, false);
        powerSound = CreateTone("Power", 220f, 0.22f, true);
        hitSound = CreateTone("Hit", 95f, 0.38f, true);
        levelSound = CreateTone("Level", 760f, 0.34f, false);
    }

    private AudioClip CreateTone(string clipName, float frequency, float duration, bool square)
    {
        const int sampleRate = 22050;
        int sampleCount = Mathf.CeilToInt(sampleRate * duration);
        var samples = new float[sampleCount];
        for (int i = 0; i < sampleCount; i++)
        {
            float wave = Mathf.Sin(2f * Mathf.PI * frequency * i / sampleRate);
            if (square) wave = wave >= 0f ? 0.75f : -0.75f;
            float envelope = 1f - (float)i / sampleCount;
            samples[i] = wave * envelope * 0.35f;
        }
        var clip = AudioClip.Create(clipName, sampleCount, 1, sampleRate, false);
        clip.SetData(samples, 0);
        return clip;
    }

    private void PlaySound(AudioClip clip, float volume)
    {
        if (audioSource != null && clip != null) audioSource.PlayOneShot(clip, volume);
    }

    private void OnGUI()
    {
        var hudStyle = new GUIStyle(GUI.skin.label) { fontSize = Mathf.Clamp(Screen.width / 34, 18, 30), normal = { textColor = new Color(0.8f, 0.95f, 1f) } };
        GUI.Label(new Rect(22f, 18f, Screen.width - 44f, 96f), hudText, hudStyle);

        if (startTimer > 0f || gameOver)
        {
            var messageStyle = new GUIStyle(hudStyle) { alignment = TextAnchor.MiddleCenter, fontSize = Mathf.Clamp(Screen.width / 20, 30, 52), normal = { textColor = new Color(1f, 0.82f, 0.16f) } };
            GUI.Label(new Rect(0f, Screen.height * 0.36f, Screen.width, 150f), messageText, messageStyle);
        }

        if (Screen.width < 900)
        {
            float size = Mathf.Clamp(Screen.width * 0.16f, 62f, 104f);
            float x = Screen.width - size * 2.25f;
            float y = Screen.height - size * 1.25f;
            if (GUI.Button(new Rect(x, y, size, size), "LEFT")) SetDirection("left");
            if (GUI.Button(new Rect(x + size * 1.12f, y, size, size), "RIGHT")) SetDirection("right");
            if (GUI.Button(new Rect(x - size * 0.56f, y - size * 0.98f, size, size), "UP")) SetDirection("up");
            if (GUI.Button(new Rect(x + size * 0.56f, y - size * 0.98f, size, size), "DOWN")) SetDirection("down");
        }
    }

    private void ClearDots()
    {
        foreach (GameObject dot in dots.Values) if (dot != null) Destroy(dot);
        dots.Clear();
    }

    private void UpdateHud()
    {
        hudText = "UNITY NEON MAZE\nSCORE " + score + "    LIVES " + lives + "    LEVEL " + level + (frightenedTimer > 0f ? "    POWER " + Mathf.CeilToInt(frightenedTimer) : "");
    }
}
