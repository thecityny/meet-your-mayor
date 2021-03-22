module.exports = function (setProfileImage, track) {
  const loginPrompt = document.querySelector(".login-prompt");
  const loginButtons = document.querySelector(".login-buttons");
  
  const services = {
    fb: {
      button: document.querySelector("#fb-button"),
      buttonText: document.querySelector("#fb-button .fb-button-text"),
      class: "facebook",
      name: "Facebook"
    },
    g: {
      button: document.querySelector("#g-button"),
      buttonText: document.querySelector("#g-button .g-button-text"),
      class: "google",
      name: "Google"
    }
  }
  const serviceClasses = Object.values(services).map(service => service.class);
  
  // Facebook
  window.fbAsyncInit = function () {
    FB.init({
      appId: "3802878269795841",
      status: true,
      xfbml: false,
      version: "v10.0"
    });

    addFacebookHandlers();
  };
    
  function addFacebookHandlers() {
    FB.Event.subscribe("auth.statusChange", async response => {
      if (response.status === 'connected') {
        try {
          const user = await getFacebookUser(response.authResponse);
          login(services.fb, user);
        } catch (e) {
          console.error(e);
        }
      } else {
        logout(services.fb);
      }
    });
    
    services.fb.button.addEventListener("click", e => {
      FB.getLoginStatus(response => {
        if (response.status !== 'connected') {
          track("click:login", "facebook");
          FB.login();
        } else {
          track("click:logout", "facebook");
          FB.logout();
        }
      });
    });
  }

  function getFacebookUser (authResponse) {
    const image = new Promise((resolve, reject) => {
      FB.api(
        `/${authResponse.userID}/picture`,
        'GET',
        {
          redirect: 0,
          width: 200,
          height: 200
        },
        response => {
          if (!response || response.error) {
            reject(response && response.error || "An error occurred");
          } else {
            resolve(response.data.url);
          }
        }
      );
    });
  
    const name = new Promise((resolve, reject) => {
      FB.api('/me', function(response) {
        if (!response || response.error) {
          reject(response && response.error || "An error occurred");
        } else {
          resolve(response.name);
        }
      });
    });
  
    return Promise.all([image, name]).then(([image, name]) => {
      return {image, name};
    });
  }
  
  // Google
  window.gAsyncInit = function () {
    gapi.load("auth2", () => {
      gapi.auth2.init({
        client_id: "814604771693-fs3jolnobt3qn1hdbrcnue6vs5mkqm96.apps.googleusercontent.com",
        cookiepolicy: "single_host_origin",
        scope: "profile"
      })
        .then(auth2 => addGoogleHandlers(auth2))
        .catch(console.error);
    });
  }
  
  function addGoogleHandlers(auth2) {
    auth2.isSignedIn.listen(isSignedIn => {
      if (isSignedIn) {
        const googleUser = auth2.currentUser.get();
        const user = getGoogleUser(googleUser);
        login(services.g, user);
      } else {
        logout(services.g);
      }
    });
  
    services.g.button.addEventListener("click", async e => {
      if (!auth2.isSignedIn.get()) {
        track("click:login", "twitter");
        try {
          await auth2.signIn();
        } catch (e) {
          console.error(e);
        }
      } else {
        track("click:logout", "twitter");
        try {
          auth2.signOut();
        } catch (e) {
          console.error(e);
        }
      }
    });

    if (auth2.isSignedIn.get() == true) {
      const googleUser = auth2.currentUser.get();
      const user = getGoogleUser(googleUser);
      login(services.g, user);
    }
  };

  function getGoogleUser(googleUser) {
    const profile = googleUser.getBasicProfile();
    return {
      image: profile.getImageUrl(),
      name: profile.getName()
    };
  }
  
  function login(service, user) {
    const {image, name} = user;
    service.buttonText.innerHTML = "Log out";
    serviceClasses.forEach(serviceClass => {
      loginButtons.classList.remove(serviceClass);
    });
    loginButtons.classList.add(service.class);
    loginPrompt.innerHTML = "Using profile image for " + name;
    setProfileImage(image);
  }
  
  function logout (service) {
    setProfileImage("");
    loginPrompt.innerHTML = "Customize your results with your profile image";
    service.buttonText.innerHTML = `Log in with ${service.name}`;
    loginButtons.classList.remove(service.class);
  }
}