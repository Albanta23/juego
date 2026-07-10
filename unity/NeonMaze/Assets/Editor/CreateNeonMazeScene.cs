using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEditor.Build.Reporting;
using UnityEngine;

public static class CreateNeonMazeScene
{
    private const string ScenePath = "Assets/NeonMaze.unity";
    private const string MaterialPath = "Assets/NeonRuntime.mat";

    [MenuItem("Tools/Neon Maze/Create Scene")]
    public static void CreateScene()
    {
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        var game = new GameObject("Neon Maze Game");
        game.AddComponent<NeonMazeGame>();
        EditorSceneManager.SaveScene(scene, ScenePath);
        EnsureRuntimeAssets();
        Selection.activeGameObject = game;
    }

    [MenuItem("Tools/Neon Maze/Build WebGL")]
    public static void BuildWebGL()
    {
        if (!System.IO.File.Exists(ScenePath)) CreateScene();
        EnsureRuntimeAssets();

        // Keep the export compatible with static hosts that do not set gzip headers.
        PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Disabled;
        PlayerSettings.stripEngineCode = false;

        var options = new BuildPlayerOptions
        {
            scenes = new[] { ScenePath },
            locationPathName = "../../web/unity/neonmaze",
            target = BuildTarget.WebGL,
            options = BuildOptions.None
        };
        BuildReport report = BuildPipeline.BuildPlayer(options);
        Debug.Log("Neon Maze build result: " + report.summary.result + " (" + report.summary.totalSize + " bytes)");
        if (Application.isBatchMode)
            EditorApplication.Exit(report.summary.result == BuildResult.Succeeded ? 0 : 1);
    }

    private static void EnsureRuntimeAssets()
    {
        Material material = AssetDatabase.LoadAssetAtPath<Material>(MaterialPath);
        if (material == null)
        {
            Shader shader = Shader.Find("Standard");
            if (shader == null) throw new System.InvalidOperationException("Standard shader is unavailable in the editor.");
            material = new Material(shader) { name = "Neon Runtime Material" };
            AssetDatabase.CreateAsset(material, MaterialPath);
        }

        var game = Object.FindFirstObjectByType<NeonMazeGame>();
        if (game == null)
        {
            EditorSceneManager.OpenScene(ScenePath);
            game = Object.FindFirstObjectByType<NeonMazeGame>();
        }
        if (game == null) throw new System.InvalidOperationException("NeonMazeGame is missing from the scene.");

        game.baseMaterial = material;
        EditorUtility.SetDirty(game);
        EditorSceneManager.MarkSceneDirty(game.gameObject.scene);
        EditorSceneManager.SaveScene(game.gameObject.scene);
        AssetDatabase.SaveAssets();
    }
}
