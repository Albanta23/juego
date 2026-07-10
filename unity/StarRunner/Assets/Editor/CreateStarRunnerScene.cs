using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEditor.Build.Reporting;
using UnityEngine;

public static class CreateStarRunnerScene
{
    private const string ScenePath = "Assets/StarRunner.unity";
    private const string MaterialPath = "Assets/StarRunnerRuntime.mat";

    [MenuItem("Tools/Star Runner/Create Scene")]
    public static void CreateScene()
    {
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        var game = new GameObject("Star Runner Game");
        game.AddComponent<StarRunnerGame>();
        EditorSceneManager.SaveScene(scene, ScenePath);
        EnsureRuntimeAssets();
        Selection.activeGameObject = game;
    }

    [MenuItem("Tools/Star Runner/Build WebGL")]
    public static void BuildWebGL()
    {
        if (!System.IO.File.Exists(ScenePath)) CreateScene();
        EnsureRuntimeAssets();

        PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Disabled;
        PlayerSettings.stripEngineCode = false;
        var options = new BuildPlayerOptions
        {
            scenes = new[] { ScenePath },
            locationPathName = "../../web/unity/starrunner",
            target = BuildTarget.WebGL,
            options = BuildOptions.None
        };
        BuildReport report = BuildPipeline.BuildPlayer(options);
        Debug.Log("Star Runner build result: " + report.summary.result + " (" + report.summary.totalSize + " bytes)");
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
            material = new Material(shader) { name = "Star Runner Runtime Material" };
            AssetDatabase.CreateAsset(material, MaterialPath);
        }

        var game = Object.FindFirstObjectByType<StarRunnerGame>();
        if (game == null)
        {
            EditorSceneManager.OpenScene(ScenePath);
            game = Object.FindFirstObjectByType<StarRunnerGame>();
        }
        if (game == null) throw new System.InvalidOperationException("StarRunnerGame is missing from the scene.");

        game.baseMaterial = material;
        EditorUtility.SetDirty(game);
        EditorSceneManager.MarkSceneDirty(game.gameObject.scene);
        EditorSceneManager.SaveScene(game.gameObject.scene);
        AssetDatabase.SaveAssets();
    }
}
