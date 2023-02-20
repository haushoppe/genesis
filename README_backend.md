# Backend API

The API is hosted at koyeb.com

* https://backend.haushoppe.art/
* https://backend-teamkow593gppp.koyeb.app/


### List Deployments

```
curl -X GET "https://app.koyeb.com/v1/deployments?limit=2" \
     -H "Authorization: Bearer API_KEY" | json_pp -json_opt pretty,canonical
```

### List Apps

```
curl -X GET "https://app.koyeb.com/v1/apps" \
     -H "Authorization: Bearer API_KEY" | json_pp -json_opt pretty,canonical
```

### List Services

```
curl -X GET "https://app.koyeb.com/v1/services" \
     -H "Authorization: Bearer API_KEY" | json_pp -json_opt pretty,canonical
```

### Redeploy Service of backend.haushoppe.art

```
curl -X POST "https://app.koyeb.com/v1/services/26aa4bdc-538f-4bbd-8f2d-38ec9be7959f/redeploy" \
     -H "Authorization: Bearer API_KEY" | json_pp -json_opt pretty,canonical
```
