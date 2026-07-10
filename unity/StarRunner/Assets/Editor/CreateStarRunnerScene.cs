using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

public static class CreateStarRunnerScene
{
    [MenuItem("Tools/Star Runner/Create Scene")]
    public static void CreateScene()
    {
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        var game = new GameObject("Star Runner Game");
        game.AddComponent<StarRunnerGame>();
        EditorSceneManager.SaveScene(scene, "Assets/StarRunner.unity");
        Selection.activeGameObject = game;
    }
}
